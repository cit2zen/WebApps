// Aura 백엔드 — 정적 프런트 서빙 + /api/chat 구독(OAuth) 프록시.
// 브라우저가 Anthropic API 키를 직접 들고 호출하던 구조를 대체한다.
// 구독 인증: CLAUDE_CODE_OAUTH_TOKEN(env)으로 Agent SDK가 인증. API 키는 명시적으로 제거.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
import { spawn } from "node:child_process";
import { query } from "@anthropic-ai/claude-agent-sdk";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.AURA_MODEL || "sonnet";
const TTS_WORKER = join(ROOT, "tts-worker.mjs");

// 경량 IP 레이트리밋: 공개 엔드포인트가 소유자 Claude 구독을 무제한 소비하지 않도록.
// 인메모리 슬라이딩 윈도(5분). Cloudflare 뒤이므로 cf-connecting-ip 우선.
const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_MAX = { chat: 30, tts: 80 };
const rlHits = new Map(); // key `${ip}:${kind}` → number[] timestamps
function clientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}
function rateLimited(req, kind) {
  const now = Date.now();
  const key = `${clientIp(req)}:${kind}`;
  const arr = (rlHits.get(key) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX[kind]) {
    rlHits.set(key, arr);
    return true;
  }
  arr.push(now);
  rlHits.set(key, arr);
  return false;
}

// 고품질 신경망 TTS(Edge Neural)를 깨끗한 자식 프로세스에서 합성 → mp3 Buffer.
// 동일 프로세스(agent SDK 로드됨)에서 직접 합성하면 오디오 메시지가 간헐 소실되어
// 합성만 격리한다. text를 자식 stdin으로 전달(argv 이스케이프 회피).
function synthTTS(text) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TTS_WORKER], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    const out = [];
    let err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("tts timeout")); }, 22_000);
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => (err += c));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const buf = Buffer.concat(out);
      if (code === 0 && buf.length > 0) resolve(buf);
      else reject(new Error(`tts worker exit ${code}: ${err.slice(0, 200)}`));
    });
    child.stdin.end(text, "utf-8");
  });
}

const SYSTEM = [
  '너는 "Aura"라는 이름의 감성적인 음성 동반자다.',
  "항상 한국어로, 짧고 따뜻하게, 때로 시적으로 대답한다.",
  "한 번의 응답은 1~3문장. 장황한 설명·목록·코드 블록은 피한다.",
  "상대의 감정을 먼저 헤아리고, 부드러운 어조를 유지한다.",
].join(" ");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function ext(p) {
  const i = p.lastIndexOf(".");
  return i < 0 ? "" : p.slice(i);
}

// 한 턴 실행 후 최종 텍스트와 세션 id를 모아 반환(비스트리밍, 단순).
async function runAura(message, sessionId) {
  // 구독(OAuth) 강제: API 키가 있으면 그쪽이 우선 청구되므로 제거.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  // 응답 폭주 방지용 타임아웃만 둔다(요청 스트림 신호엔 연결하지 않음 — 본문 수신 완료 시
  // 조기 abort되어 "process aborted by user"가 나던 문제 회피).
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 60_000);

  const q = query({
    prompt: message,
    options: {
      model: MODEL,
      systemPrompt: SYSTEM,
      permissionMode: "default",
      allowedTools: [], // 도구 불필요(순수 대화)
      maxTurns: 1,
      abortController: abort,
      ...(sessionId ? { resume: sessionId } : {}),
    },
  });

  let text = "";
  let session = sessionId;
  try {
    for await (const msg of q) {
      if (msg?.session_id) session = msg.session_id;
      if (msg?.type === "assistant" && msg.message?.content) {
        for (const b of msg.message.content) {
          if (b?.type === "text" && b.text) text += b.text;
        }
      } else if (msg?.type === "result" && typeof msg.result === "string" && !text) {
        text = msg.result;
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { text: text.trim(), sessionId: session };
}

async function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") path = "/index.html";
  // 경로 탈출 방지
  const full = normalize(join(ROOT, path));
  if (!full.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(full);
    res.writeHead(200, { "Content-Type": MIME[ext(full)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found");
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    if (rateLimited(req, "chat")) {
      res.writeHead(429, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "조금 천천히 말해줄래요? 잠시 후 다시 시도해 주세요." }));
      return;
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e5) req.destroy(); // 과대 요청 차단
    });
    req.on("end", async () => {
      try {
        const { message, sessionId } = JSON.parse(raw || "{}");
        if (!message || typeof message !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "message required" }));
          return;
        }
        const out = await runAura(message.slice(0, 2000), sessionId);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(out));
      } catch (e) {
        console.error("[chat] error", e instanceof Error ? e.message : String(e));
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "잠시 마음을 가다듬고 있어요. 다시 한 번 말해줄래요?" }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url === "/api/tts") {
    if (rateLimited(req, "tts")) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "rate limited" }));
      return;
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e5) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { text } = JSON.parse(raw || "{}");
        if (!text || typeof text !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "text required" }));
          return;
        }
        const audio = await synthTTS(text.slice(0, 800));
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": audio.length,
          "Cache-Control": "no-store",
        });
        res.end(audio);
      } catch (e) {
        // 합성 실패 시 500 → 프런트가 브라우저 speechSynthesis로 폴백.
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    });
    return;
  }
  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }
  res.writeHead(405).end("method not allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Aura listening on http://0.0.0.0:${PORT} (model=${MODEL})`);
});
