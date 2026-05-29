// 수확 효과음. 공유 컨텍스트의 sfx 게인으로 출력.
import { getCtx, nodes } from "./audio.js";

export { unlock } from "./audio.js";

// 제거한 사과 수가 많을수록 높은 "팝".
export function pop(count = 1) {
  const c = getCtx();
  const t = c.currentTime;
  const base = 480 + Math.min(count, 8) * 45;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  o.connect(g).connect(nodes.sfx);
  o.start(t);
  o.stop(t + 0.26);
}

// 남은 시간이 얼마 없을 때 째깍 경고음.
export function tick() {
  const c = getCtx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(880, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(nodes.sfx);
  o.start(t);
  o.stop(t + 0.12);
}

// 시간 종료 부저 — 두 음 하강.
export function timeUp() {
  const c = getCtx();
  const t = c.currentTime;
  [
    [440, 0],
    [330, 0.18],
  ].forEach(([f, dt]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t + dt);
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.exponentialRampToValueAtTime(0.7, t + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.32);
    o.connect(g).connect(nodes.sfx);
    o.start(t + dt);
    o.stop(t + dt + 0.34);
  });
}
