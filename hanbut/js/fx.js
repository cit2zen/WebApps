// fx.js — 인게임 효과 타임라인 큐(add/tick/list) + 5종(pulseRing·ghostDrop·dangerPulse·hintDots·hintRing)
// + 잉크 보간(inkFill 90ms ease-out / inkAbsorb 70ms ease-in). render를 import하지 않는다(draw(ctx, L)의 L 인자).
// 효과 객체 = { t0, dur, draw(ctx, L), tick?(dt, now) }. 진행률 = min(1, (now − t0) / dur), now = tick dt 누적(clock).
import * as rng from './rng.js';

export const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const R = () => (rng.next || rng.random || rng.rand || Math.random)();
const TAU = Math.PI * 2, DASH = [6, 6], NODASH = [];
let now = 0, fastUntil = -1, ghostOn = false, cyc = -1, jit = 0;
const active = [];

const cx = (L, i) => L.ox + (i % L.w + 0.5) * L.cell;
const cy = (L, i) => L.oy + (Math.floor(i / L.w) + 0.5) * L.cell;
export function cellPath(c, L, i) {               // 칸 라운드 사각 경로(fx_clear 공용)
  const x = L.ox + (i % L.w) * L.cell + 1, y = L.oy + Math.floor(i / L.w) * L.cell + 1;
  const w = L.cell - 2, r = Math.min(4, L.cell * 0.1);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + w, r); c.arcTo(x + w, y + w, x, y + w, r);
  c.arcTo(x, y + w, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const wave = (t, period) => 0.5 - 0.5 * Math.cos(TAU * t / period);   // 0..1

// ── 드로잉 5종(§5 pulseRing·ghostDrop·dangerPulse·hintDots·hintRing의 캔버스 구현) ──
function drawPulse(c, L, i, ph) {                 // S 맥동: 스케일 1.00↔1.08, α 0.6↔1.0, 채움 --gold-light·테두리 --gold-dark 2px
  const r = L.cell * 0.3 * (1 + 0.08 * ph);
  c.globalAlpha = 0.6 + 0.4 * ph;
  c.beginPath(); c.arc(cx(L, i), cy(L, i), r, 0, TAU);
  c.fillStyle = L.T.goldLight; c.fill(); c.lineWidth = 2; c.strokeStyle = L.T.goldDark; c.stroke(); L.calls += 2;
  c.globalAlpha = 1;
}
function haloPulse(c, L, i, ph) {                 // 머리칸 헤일로 0.6s×2 맥동(규칙 5, len ≥ 2 무효 터치)
  c.globalAlpha = 0.3 + 0.7 * ph;
  c.beginPath(); c.arc(cx(L, i), cy(L, i), L.halo * (0.55 + 0.1 * ph), 0, TAU);
  c.lineWidth = 2; c.strokeStyle = L.T.goldMid; c.stroke(); L.calls++;
  c.globalAlpha = 1;
}
function drawGhost(c, L, a, b, q) {               // S → sol[1] 방울 r 0.12칸, --hb-ghost(α 내장)
  const x = cx(L, a) + (cx(L, b) - cx(L, a)) * q, y = cy(L, a) + (cy(L, b) - cy(L, a)) * q;
  c.beginPath(); c.arc(x + jit * (cy(L, b) - cy(L, a)), y + jit * (cx(L, b) - cx(L, a)), L.cell * 0.12, 0, TAU);
  c.fillStyle = L.T.hbGhost; c.fill(); L.calls++;
}
function drawDanger(c, L, i, a) {                // 머리칸 --hb-alert α 0.6→0, 3×200ms
  c.globalAlpha = a; cellPath(c, L, i); c.fillStyle = L.T.hbAlert; c.fill(); L.calls++; c.globalAlpha = 1;
}
function drawHintDots(c, L, head, cells) {            // 머리칸 → 다음 3칸 점선(3px, dash 6/6, --gold-dark)
  c.beginPath(); c.moveTo(cx(L, head), cy(L, head));
  for (let k = 0; k < cells.length; k++) c.lineTo(cx(L, cells[k]), cy(L, cells[k]));
  for (let k = 0; k < cells.length; k++) {
    c.moveTo(cx(L, cells[k]) + L.cell * 0.14, cy(L, cells[k])); c.arc(cx(L, cells[k]), cy(L, cells[k]), L.cell * 0.14, 0, TAU);
  }
  dashed(c, L);
}
function drawHintRing(c, L, i) {                      // '여기부터 다시' 링
  c.beginPath(); c.arc(cx(L, i), cy(L, i), L.cell * 0.38, 0, TAU); dashed(c, L);
}
function dashed(c, L) {
  c.setLineDash(DASH); c.lineWidth = 3; c.lineCap = 'butt'; c.strokeStyle = L.T.goldDark; c.stroke(); L.calls++;
  c.setLineDash(NODASH);
}

// ── 상주 효과: S 맥동 · 고스트(경로가 S뿐일 때만 그림) ──
const pulse = { t0: 0, dur: Infinity, draw(c, L) {
  const v = L.view; if (!v || v.len !== 1 || !v.level) return;
  drawPulse(c, L, v.level.start, REDUCED ? 1 : wave(now, now < fastUntil ? 600 : 1200));
} };
const ghost = { t0: 0, dur: Infinity, draw(c, L) {
  const v = L.view; if (!v || v.len !== 1 || !v.level || !(ghostOn || v.ghost)) return;
  const sol = v.level.sol; if (!sol || sol.length < 2) return;
  if (REDUCED) { drawGhost(c, L, sol[0], sol[1], 0.5); return; }   // 고정 표현
  const k = Math.floor(now / 500), t = now - k * 500;
  if (k !== cyc) { cyc = k; jit = (R() - 0.5) * 0.06; }
  if (t < 400) drawGhost(c, L, sol[0], sol[1], 1 - (1 - t / 400) * (1 - t / 400));
} };
const ink = { t0: 0, dur: 90, ink: 0, p: 1, cell: -1, draw() {}, tick() {   // render가 e.ink·e.p·e.cell을 읽음
  const q = Math.min(1, (now - this.t0) / this.dur);
  this.p = this.ink === 1 ? 1 - (1 - q) * (1 - q) : q * q;
} };
const hint = { t0: 0, dur: 3000, cells: [], back: -1, draw(c, L) {
  const v = L.view; if (!v) return;
  if (this.back >= 0) drawHintRing(c, L, this.back); else if (this.cells.length) drawHintDots(c, L, v.head, this.cells);
} };
const inval = { t0: 0, dur: 1200, draw(c, L) {   // len ≥ 2: 헤일로 맥동(len 1이면 pulse가 0.6s 주기로 대체)
  const v = L.view; if (!v || v.len < 2) return;
  haloPulse(c, L, v.head, REDUCED ? 1 : wave(now - this.t0, 600));
} };
const danger = { t0: 0, dur: 600, draw(c, L) {
  const v = L.view; if (!v) return;
  drawDanger(c, L, v.head, REDUCED ? 0.6 : 0.6 * (1 - ((now - this.t0) % 200) / 200));
} };
active.push(pulse, ghost);

function removeAt(i) { for (let j = i; j < active.length - 1; j++) active[j] = active[j + 1]; active.length--; }
function drop(e) { const i = active.indexOf(e); if (i >= 0) removeAt(i); }
function start(e, dur) { e.t0 = now; if (dur) e.dur = dur; if (active.indexOf(e) < 0) active.push(e); return e; }
function clearTransient() { for (let i = active.length - 1; i >= 0; i--) if (active[i].dur !== Infinity) removeAt(i); fastUntil = -1; }

export function list() { return active; }         // render.draw(view, fx.list()) — 재사용 배열
export function tick(dt) {
  now += dt;
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i];
    if (e.tick) e.tick(dt, now);
    if (now - e.t0 >= e.dur) removeAt(i);
  }
}
export function setGhost(on) { ghostOn = !!on; }   // game ghost{on} 배선용(view().ghost와 OR)

// add(효과 객체) = 원시 효과 등록(fx_clear 공용, t0 생략 시 현재 시각).
// add(이벤트명, payload) = 게임 이벤트 → 효과: levelIn·push·pop·cut·reset·invalid·deadend·hint·ghost·state.
export function add(k, p) {
  if (k && typeof k === 'object') { if (k.t0 === undefined) k.t0 = now; if (active.indexOf(k) < 0) active.push(k); return k; }
  switch (k) {
    case 'levelIn': clearTransient(); cyc = -1; break;
    case 'state': if (p && p.to === 'idle') clearTransient(); break;
    case 'push': ink.ink = 1; ink.p = 0; start(ink, 90); break;
    case 'pop': ink.ink = -1; ink.p = 0; ink.cell = p && p.cell != null ? p.cell : -1; start(ink, 70); break;
    case 'cut': case 'reset': drop(ink); drop(hint); break;
    case 'invalid': fastUntil = now + 1200; start(inval, 1200); break;
    case 'deadend': start(danger, 600); break;
    case 'hint':
      hint.back = p && p.backCell != null ? p.backCell : -1;
      hint.cells = p && p.cells ? p.cells.slice(0, 3) : [];
      start(hint, 3000); break;
    case 'ghost': setGhost(p && typeof p === 'object' ? p.on : p); break;
    default: return null;
  }
  return true;
}
export const handle = add;
// main.js 배선용 이름(§5 효과명): 이벤트 → 효과 시작
export function inkFill() { add('push'); }
export function inkAbsorb(cell) { add('pop', { cell: cell == null ? -1 : cell }); }
export function pulseRing() { add('invalid'); }    // 무효 터치: len 1 → S 0.6s×2 · len ≥ 2 → 헤일로 0.6s×2
export function dangerPulse() { add('deadend'); }
export function hintDots(cells) { add('hint', { cells }); }
export function hintRing(cell) { add('hint', { backCell: cell }); }
export function time() { return now; }
