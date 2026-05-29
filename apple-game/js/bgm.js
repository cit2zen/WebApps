// 배경음악: 부드러운 코드 패드를 한 번 합성해 버퍼로 만들고 loop 재생.
// 스케줄러/타이머 없이 AudioBufferSourceNode.loop로 끊김없이 반복.
import { getCtx, nodes } from "./audio.js";

// lo-fi 진행: Cmaj → Amin → Fmaj → Gmaj (각 2초)
const CHORDS = [
  [261.63, 329.63, 392.0],
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66],
];
const CHORD_SEC = 2;

let buffer = null;
let src = null;
let playing = false;

function build(c) {
  const sr = c.sampleRate;
  const len = sr * CHORD_SEC * CHORDS.length;
  buffer = c.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);
  const seg = sr * CHORD_SEC;

  CHORDS.forEach((freqs, ci) => {
    const start = ci * seg;
    for (let n = 0; n < seg; n++) {
      const tt = n / sr;
      // 코드 경계마다 부드럽게 페이드 → 루프 이음새 클릭 방지
      const env = Math.sin((Math.PI * n) / seg);
      let s = 0;
      for (const f of freqs) {
        s += Math.sin(2 * Math.PI * f * tt) * 0.18;
        s += Math.sin(2 * Math.PI * f * 2 * tt) * 0.05; // 약한 배음
      }
      s += Math.sin(2 * Math.PI * (freqs[0] / 2) * tt) * 0.12; // 베이스
      data[start + n] = s * env * 0.5;
    }
  });
}

export function startBgm() {
  if (playing) return;
  const c = getCtx();
  if (!buffer) build(c);
  src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(nodes.bgm);
  src.start();
  playing = true;
}

export function stopBgm() {
  if (src) { try { src.stop(); } catch (_) {} src.disconnect(); src = null; }
  playing = false;
}

export function isPlaying() { return playing; }
