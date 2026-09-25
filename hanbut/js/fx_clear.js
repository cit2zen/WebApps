// fx_clear.js — 클리어 효과 3종: clearWave(경로 순서 골드 파도) · confetti(종이 조각 40) · shake(#board.shake CSS 토글).
// fx.js의 REDUCED·add·cellPath만 import(fx는 이 파일을 import하지 않음). REDUCED: 파도 = 즉시 골드, 조각 미생성, .shake 미추가.
import { REDUCED, add as addFx, cellPath } from './fx.js';
import * as rng from './rng.js';

const R = () => (rng.next || rng.random || rng.rand || Math.random)();
const N = 40, LIFE = 600, G = 400;                // 수명 600ms · 초속 120~240px · 중력 400px/s²
const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
const A = new Float32Array(N), VA = new Float32Array(N), C = new Uint8Array(N);

// 파도: 칸당 지연 min(12, 300/n)ms로 --bg-card 플래시 → --gold-light 홀드, 총 350ms.
const wave = { t0: 0, dur: 350, age: 0, path: [], n: 0,
  tick(dt) { this.age += dt; },
  draw(c, L) {
    const per = Math.min(12, 300 / this.n);
    for (let i = 0; i < this.n; i++) {
      const lt = this.age - i * per;
      if (!REDUCED && lt < 0) break;
      cellPath(c, L, this.path[i]);
      c.fillStyle = !REDUCED && lt < 60 ? L.T.bgCard : L.T.goldLight; c.fill(); L.calls++;
    }
  } };

// 종이 조각: 6×10px 회전 사각 × 4색(--gold-light·--gold-mid·--cream-500·--bg-card), 머리칸에서 방사.
const conf = { t0: 0, dur: LIFE, age: 0, from: -1, ready: false,
  tick(dt) {
    this.age += dt;
    if (!this.ready) return;
    const s = dt / 1000;
    for (let i = 0; i < N; i++) { X[i] += VX[i] * s; Y[i] += VY[i] * s; VY[i] += G * s; A[i] += VA[i] * s; }
  },
  draw(c, L) {
    if (!this.ready) {                            // 첫 프레임에 레이아웃으로 원점 확정(할당 없음)
      const x = L.ox + (this.from % L.w + 0.5) * L.cell, y = L.oy + (Math.floor(this.from / L.w) + 0.5) * L.cell;
      for (let i = 0; i < N; i++) {
        const ang = -Math.PI * (0.05 + 0.9 * R()), sp = 120 + 120 * R();
        X[i] = x; Y[i] = y; VX[i] = Math.cos(ang) * sp; VY[i] = Math.sin(ang) * sp;
        A[i] = R() * Math.PI * 2; VA[i] = (R() - 0.5) * 12; C[i] = Math.floor(R() * 4);
      }
      this.ready = true;
    }
    const T = L.T, d = L.dpr;
    c.globalAlpha = Math.max(0, 1 - this.age / LIFE);
    for (let i = 0; i < N; i++) {
      const cs = Math.cos(A[i]), sn = Math.sin(A[i]), k = C[i];
      c.setTransform(d * cs, d * sn, -d * sn, d * cs, d * X[i], d * Y[i]);
      c.fillStyle = k === 0 ? T.goldLight : k === 1 ? T.goldMid : k === 2 ? T.cream500 : T.bgCard;
      c.fillRect(-3, -5, 6, 10); L.calls += 2;     // setTransform + fillRect
    }
    c.setTransform(d, 0, 0, d, 0, 0); c.globalAlpha = 1;
  } };

const pathOf = p => (Array.isArray(p) ? p : p && p.path) || null;

export function clearWave(p) {
  const path = pathOf(p); if (!path || !path.length) return;
  wave.path = path.slice(); wave.n = path.length; wave.age = 0; wave.t0 = undefined;
  addFx(wave);
}
export function confetti(p) {
  const path = pathOf(p); if (REDUCED || !path || !path.length) return;
  conf.from = path[path.length - 1]; conf.age = 0; conf.ready = false; conf.t0 = undefined;
  addFx(conf);
}
// 무효 터치 흔들림(격자 ±8px 120ms): play.css의 .shake 키프레임을 재시작.
export function shake(board) {
  if (REDUCED || typeof document === 'undefined') return;
  const b = board || document.getElementById('board'); if (!b) return;
  b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
  b.addEventListener('animationend', unshake, { once: true });
}
function unshake(e) { e.currentTarget.classList.remove('shake'); }

// clear{path} → 파도 + 종이 조각. 이벤트명 배선 호환: add('clear', p) · add('invalid').
export function clear(p) { clearWave(p); confetti(p); }
export function add(name, p) {
  if (name === 'clear') clear(p); else if (name === 'invalid') shake(); else return null;
  return true;
}
export const handle = add;
