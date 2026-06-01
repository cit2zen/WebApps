// lib/tts-worker.mjs
// Edge Neural TTS 합성 워커 — 깨끗한 자식 프로세스에서 실행.
// Next 서버 프로세스는 agent SDK가 로드돼 동일 프로세스 내 합성 시 오디오 메시지가
// 간헐 소실된다(글로벌 오염 추정) → 합성만 격리. stdin=텍스트, stdout=mp3, 실패 시 exit≠0.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE = process.env.JARVIS_TTS_VOICE || "ko-KR-InJoonNeural"; // 차분한 남성(자비스 톤)
const RATE = process.env.JARVIS_TTS_RATE || "+4%";
const PITCH = process.env.JARVIS_TTS_PITCH || "-2%";

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function synthOnce(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: RATE, pitch: PITCH });
  const chunks = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 15_000);
    audioStream.on("data", (c) => chunks.push(c));
    audioStream.on("end", () => { clearTimeout(timer); resolve(); });
    audioStream.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) throw new Error("empty audio");
  return buf;
}

async function main() {
  const text = (await readStdin()).trim().slice(0, 800);
  if (!text) process.exit(2);
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const buf = await synthOnce(text);
      process.stdout.write(buf, () => process.exit(0));
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  process.stderr.write(String(lastErr?.message || lastErr || "tts failed"));
  process.exit(3);
}

main().catch((e) => { process.stderr.write(String(e?.message || e)); process.exit(1); });
