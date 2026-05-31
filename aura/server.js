// Aura 백엔드 — 정적 프런트 서빙 + /api/chat 구독(OAuth) 프록시.
// 브라우저가 Anthropic API 키를 직접 들고 호출하던 구조를 대체한다.
// 구독 인증: CLAUDE_CODE_OAUTH_TOKEN(env)으로 Agent SDK가 인증. API 키는 명시적으로 제거.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.AURA_MODEL || "sonnet";

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
async function runAura(message, sessionId, signal) {
  // 구독(OAuth) 강제: API 키가 있으면 그쪽이 우선 청구되므로 제거.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  const abort = new AbortController();
  if (signal) {
    if (signal.aborted) abort.abort();
    else signal.addEventListener("abort", () => abort.abort(), { once: true });
  }

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
        const out = await runAura(message.slice(0, 2000), sessionId, req.signal);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(out));
      } catch (e) {
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
