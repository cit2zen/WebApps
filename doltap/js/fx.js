// fx.js — 파티클 풀(상한 60, 흙먼지 12·금가루 20), 수명·중력, 넘치면 오래된 것부터 제거 (§5·§6 성능 예산)
import { col } from './theme.js';

export const CAP = 60;
// 월드 단위(px, y-up), 시간 단위 초
export const KIND = {
  dust: { n: 12, life: 0.5, g: 300, vx: 70, vy0: 20, vy1: 90, r0: 1.6, r1: 3.0, color: '--doltap-dust' },
  gold: { n: 20, life: 0.8, g: 120, vx: 55, vy0: 60, vy1: 170, r0: 1.2, r1: 2.4, color: '--gold-light' }};
const P = [];

// (x, y) = 월드 좌표. rnd는 연출용(결정성 불필요, 테스트 주입 가능)
export function burst(kind, x, y, rnd = Math.random) {
  const K = KIND[kind];
  if (!K) return 0;
  for (let i = 0; i < K.n; i++) {
    P.push({
      kind, x, y, t: 0, life: K.life,
      vx: (2 * rnd() - 1) * K.vx,
      vy: K.vy0 + rnd() * (K.vy1 - K.vy0),
      r: K.r0 + rnd() * (K.r1 - K.r0)});
  }
  while (P.length > CAP) P.shift();   // 오래된 것부터
  return K.n;
}

export function update(dt) {
  if (!(dt > 0)) return;
  let w = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    p.t += dt;
    if (p.t >= p.life) continue;
    p.vy -= KIND[p.kind].g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    P[w++] = p;
  }
  P.length = w;
}

// Q = 투영 {k, ox, base, camOff}
export function draw(ctx, Q) {
  if (!P.length) return;
  ctx.save();
  for (const p of P) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = p.kind === 'gold' ? a * (0.6 + 0.4 * Math.abs(Math.sin(p.t * 18))) : a * 0.8;
    ctx.fillStyle = col(KIND[p.kind].color);
    ctx.beginPath();
    ctx.arc(Q.ox + p.x * Q.k, Q.base - (p.y - Q.camOff) * Q.k, p.r * Q.k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const count = () => P.length;
export const items = () => P.map(p => ({ ...p }));
export function clear() { P.length = 0; }
