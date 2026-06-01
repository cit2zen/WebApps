// app/api/tts/route.ts
// Edge Neural TTS — 자식 프로세스(lib/tts-worker.mjs)로 합성 → mp3 응답.
// 동일 프로세스(agent SDK 로드됨) 직접 합성은 오디오 소실 → worker 격리.
// 콜드스타트 시 첫 worker가 빈 오디오를 주는 일이 있어 새 worker로 재스폰한다.
import { spawn } from "node:child_process";
import { join } from "node:path";
// 값 import — Next standalone 트레이싱이 msedge-tts(+deps)를 출력에 포함하도록 강제.
// (실제 합성은 worker에서. 여기선 모듈 로드만; 미사용 방지로 참조만 둔다.)
import { OUTPUT_FORMAT } from "msedge-tts";
const _forceTrace = OUTPUT_FORMAT;
void _forceTrace;

export const runtime = "nodejs"; // child_process spawn → Edge 금지
export const dynamic = "force-dynamic";

const WORKER = join(process.cwd(), "lib", "tts-worker.mjs");

// 경량 IP 레이트리밋(무단 남용 방지). TTS는 문장당 호출이라 넉넉히.
const WINDOW = 60_000;
const MAX = 60;
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= MAX) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); return false;
}

function spawnWorker(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER], { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("tts timeout")); }, 22_000);
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => (err += c));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const buf = Buffer.concat(out);
      if (code === 0 && buf.length > 0) resolve(buf);
      else reject(new Error(`worker exit ${code}: ${err.slice(0, 120)}`));
    });
    child.stdin.end(text, "utf-8");
  });
}

async function synth(text: string): Promise<Buffer> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try { return await spawnWorker(text); }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 250)); }
  }
  throw lastErr instanceof Error ? lastErr : new Error("tts failed");
}

export async function POST(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limited(ip)) return new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
  let text = "";
  try { text = (((await req.json()) as { text?: string }).text || "").toString(); } catch { /* empty */ }
  if (!text.trim()) return new Response(JSON.stringify({ error: "text required" }), { status: 400 });
  try {
    const audio = await synth(text.slice(0, 800));
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(audio.length), "Cache-Control": "no-store" },
    });
  } catch (e) {
    // 실패 → 500 → 프런트가 speechSynthesis로 폴백
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "tts failed" }), { status: 500 });
  }
}
