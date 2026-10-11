// 작은 WebAudio 효과음 — 첫 사용자 동작에서 생성 (음악 music.js와 같은 컨텍스트를 씀)
import { emit } from './events.js';

let ctx = null;
let enabled = true;

/** 효과음·음악·진동 공통 소리 스위치 */
export function setSoundEnabled(on) {
  const next = !!on;
  if (next === enabled) return;
  enabled = next;
  emit('audio:sound', { on: enabled });
}
export const soundOn = () => enabled;
/** 공유 AudioContext — 아직 없으면 null */
export const getCtx = () => ctx;

export function unlockAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch { ctx = null; }
  if (ctx) emit('audio:unlock', {});
}

// [주파수, 시작(s), 길이(s), 파형, 볼륨]
const SOUNDS = {
  correct: [[660, 0, 0.12], [990, 0.08, 0.2]],
  wrong: [[196, 0, 0.22, 'square', 0.06], [147, 0.14, 0.3, 'square', 0.06]],
  clear: [[523, 0, 0.16], [659, 0.13, 0.16], [784, 0.26, 0.16], [1047, 0.39, 0.4]],
  fail: [[392, 0, 0.22], [330, 0.2, 0.22], [262, 0.4, 0.45]],
  tap: [[880, 0, 0.05, 'sine', 0.05]],
  miss: [[520, 0, 0.08, 'triangle', 0.12], [220, 0.07, 0.25, 'triangle', 0.12]],
  act: [[1200, 0, 0.05, 'triangle', 0.08], [1600, 0.05, 0.07, 'triangle', 0.07]],
  power: [[1320, 0, 0.08], [1760, 0.07, 0.08], [2093, 0.14, 0.18]],
  fever: [[523, 0, 0.1, 'square', 0.06], [659, 0.09, 0.1, 'square', 0.06], [784, 0.18, 0.1, 'square', 0.06], [1047, 0.27, 0.3, 'square', 0.07]],
  tick: [[740, 0, 0.09]],
  go: [[1047, 0, 0.3]],
  rush: [[880, 0, 0.08, 'square', 0.05], [1175, 0.08, 0.08, 'square', 0.05], [880, 0.16, 0.08, 'square', 0.05], [1397, 0.24, 0.18, 'square', 0.055]],
  split: [[700, 0, 0.05, 'triangle', 0.1], [1400, 0.05, 0.12, 'triangle', 0.09]],
  shield: [[440, 0, 0.12, 'sine', 0.12], [660, 0.06, 0.14], [880, 0.12, 0.28]],
  sticker: [[1568, 0, 0.07, 'sine', 0.1], [2093, 0.06, 0.18, 'sine', 0.1]],
  graduate: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.2], [784, 0.54, 0.12], [1047, 0.64, 0.5]],
  danger: [[330, 0, 0.1, 'sine', 0.06], [330, 0.17, 0.12, 'sine', 0.05]],
};

function tone(freq, start, dur, type = 'sine', vol = 0.14) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/** pitch: 주파수 배율(콤보가 오를수록 높게) */
export function sfx(name, pitch = 1) {
  if (!enabled || !ctx || !SOUNDS[name]) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + 0.01;
    for (const [f, s, d, type, vol] of SOUNDS[name]) tone(f * pitch, t + s, d, type, vol);
  } catch { /* 소리 실패는 무시 */ }
}
