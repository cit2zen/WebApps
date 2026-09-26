// scene.js — 한 프레임 합성: 하늘·능선 3겹·바위 사각형·돌·불안정 외곽선·매달린 돌(rotCW)·타이머 링·투영 점선 (§4·§5)
import { col, dpr, fitCanvas, skyAt, mixHex } from './theme.js';
import { drawRock, drawStone, drawOutline, localOf, cacheCount, sx, sy } from './render.js';
import { rotCW } from './stones.js';
import { mulberry32 } from './rng.js';
import * as flags from './flags.js';
import * as fx from './fx.js';

const TAU = 2 * Math.PI;
const RIDGE = [
  { base: 0.55, a: [40, 18, 7], par: 0.2, c: '--doltap-ridge-far' },
  { base: 0.65, a: [28, 12, 5], par: 0.4, c: '--doltap-ridge-mid' },
  { base: 0.75, a: [18, 8, 3], par: 0.6, c: '--doltap-ridge-near' }];
const FREQ = [0.008, 0.021, 0.053];
let cv = null, ctx = null, W = 0, H = 0, bg = null, bgKey = '', ph = [], phSeed = -1;
const ms = [];

export function attach(canvas) { cv = canvas; }
export function resize(w, h) { W = w; H = h; if (cv) ctx = fitCanvas(cv, w, h); bgKey = ''; }
export const drawMs = () => (ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0);
export const caches = () => cacheCount();

// φ_j = TAU·u, 스트림 mulberry32(seed ^ 0x165667B1), 겹 1→3 · 항 1→3 순서 9회
export function ridgePhases(seed) {
  const u = mulberry32((seed ^ 0x165667B1) >>> 0);
  return Array.from({ length: 9 }, () => TAU * u());
}
// 겹 j의 화면 위에서부터의 월드 깊이: base·Hv + Σ a·sin(f·x + φ)
export function ridgeY(j, wx, Hv, phases) {
  const L = RIDGE[j];
  let y = L.base * Hv;
  for (let q = 0; q < 3; q++) y += L.a[q] * Math.sin(FREQ[q] * wx + phases[j * 3 + q]);
  return y;
}
// aDeg로 돌린 로컬 도형의 가장 낮은 꼭짓점 [x, y](무게중심 기준, y-up). rayDown x0 = aim.x + x
export function lowPoint(stone, aDeg) {
  let best = null;
  for (const v of localOf(stone)) {
    const p = rotCW(v, ((aDeg / 15) % 24 + 24) % 24);
    if (!best || p[1] < best[1]) best = p;
  }
  return best;
}
export const ringRadius = stone => Math.max(...localOf(stone).map(([x, y]) => Math.hypot(x, y)));

function background(Q, seed, skyCm) {
  const sky = skyAt(skyCm), key = `${W}x${H}:${Q.k}:${Math.round(Q.camOff * Q.k)}:${sky}:${seed}`;
  if (key === bgKey && bg) return bg;
  if (phSeed !== seed) { ph = ridgePhases(seed); phSeed = seed; }
  bg = bg || document.createElement('canvas');
  const g = fitCanvas(bg, W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky);
  grad.addColorStop(1, mixHex(sky, col('--doltap-sky-dawn'), 0.5));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  RIDGE.forEach((L, j) => {
    g.fillStyle = col(L.c);
    g.beginPath();
    g.moveTo(Q.ox, H);
    for (let x = 0; x <= 390 * Q.k + 3; x += 3) {
      g.lineTo(Q.ox + x, ridgeY(j, x / Q.k, Q.Hv, ph) * Q.k + Q.camOff * Q.k * L.par);
    }
    g.lineTo(Q.ox + 390 * Q.k + 3, H);
    g.closePath();
    g.fill();
  });
  bgKey = key;
  return bg;
}

function hanging(c, F) {
  const v = F.view, s = F.set.stones[v.slot - 1];
  if (!s || !v.aim) return;
  const Q = F.Q, spawnY = v.Y + 180, [lx, ly] = lowPoint(s, v.aim.aDeg);
  const x0 = sx(Q, v.aim.x + lx), y0 = sy(Q, spawnY + ly);
  c.save();
  c.globalAlpha = 0.5;
  c.strokeStyle = col('--ink-muted');
  c.lineWidth = 1.5;
  c.beginPath();
  if (F.ray) {
    const y1 = sy(Q, F.ray.y);
    c.setLineDash([4, 4]);
    c.moveTo(x0, y0);
    c.lineTo(x0, y1);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.moveTo(x0 - 6, y1);
    c.lineTo(x0 + 6, y1);
  } else {
    c.moveTo(x0 - 5, y0 + 5); c.lineTo(x0 + 5, y0 + 15);
    c.moveTo(x0 + 5, y0 + 5); c.lineTo(x0 - 5, y0 + 15);
  }
  c.stroke();
  c.restore();
  drawStone(c, Q, s, F.seed, v.aim.x, spawnY, v.aim.aDeg * Math.PI / 180);
  const left = Math.max(0, Math.min(1, v.aim.stepsLeft / 600));
  c.save();
  c.strokeStyle = col(v.aim.stepsLeft >= 180 ? '--gold-mid' : '--pol-danger');
  c.lineWidth = 3;
  c.beginPath();
  c.arc(sx(Q, v.aim.x), sy(Q, spawnY), ringRadius(s) * Q.k + 4, -Math.PI / 2, -Math.PI / 2 + TAU * left);
  c.stroke();
  c.restore();
}

// F = {Q:{k,ox,base,camOff,Hv,w,h}, seed, set, view, skyCm, t, now, unstable:Set<i>, ray, maxH, guides}
export function draw(F) {
  if (!ctx) return;
  const t0 = performance.now(), Q = F.Q;
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  ctx.fillStyle = col('--bg-base');
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(Q.ox, 0, 390 * Q.k, H);
  ctx.clip();
  ctx.drawImage(background(Q, F.seed, F.skyCm), 0, 0, W, H);
  drawRock(ctx, Q);
  flags.draw(ctx, Q, { maxH: F.maxH, guides: F.guides, t: F.t });
  const blink = Math.floor(F.now / 125) % 2 === 0;   // 4Hz
  for (const b of F.view.bodies || []) {
    const s = F.set.stones[b.i - 1];
    if (!s) continue;
    drawStone(ctx, Q, s, F.seed, b.x, b.y, b.angle);
    if (blink && F.unstable.has(b.i)) drawOutline(ctx, Q, s, b.x, b.y, b.angle, col('--pol-danger'));
  }
  if (F.view.state === 'aim') hanging(ctx, F);
  fx.draw(ctx, Q);
  flags.drawPopups(ctx, Q, F.now);
  ctx.restore();
  ms.push(performance.now() - t0);
  if (ms.length > 60) ms.shift();
}
