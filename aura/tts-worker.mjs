// TTS 합성 워커 — 깨끗한 자식 프로세스에서 Edge Neural TTS 합성.
// 부모(server.js)는 agent SDK가 로드된 프로세스라 동일 프로세스 내 합성이
// 간헐적으로 오디오 메시지를 잃는다(글로벌 상태 오염 추정) → 합성만 격리 실행.
// 입력: stdin = 합성할 텍스트(UTF-8). 출력: stdout = mp3 바이트. 실패 시 exit 1.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE = process.env.AURA_TTS_VOICE || "ko-KR-SunHiNeural";
const RATE = process.env.AURA_TTS_RATE || "-6%";
const PITCH = process.env.AURA_TTS_PITCH || "+2%";

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function main() {
  const text = (await readStdin()).trim().slice(0, 800);
  if (!text) process.exit(2);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: RATE, pitch: PITCH });
  const chunks = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 18_000);
    audioStream.on("data", (c) => chunks.push(c));
    audioStream.on("end", () => { clearTimeout(timer); resolve(); });
    audioStream.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) process.exit(3);
  process.stdout.write(buf, () => process.exit(0));
}

main().catch((e) => {
  process.stderr.write(String(e?.message || e));
  process.exit(1);
});
