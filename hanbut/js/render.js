// render.js — #board 캔버스: 토큰 캐시 T · 레이아웃 · 정적 레이어 · 잉크 · 헤일로 · 썸네일/스냅샷.
// fx를 import하지 않는다 — 효과는 draw(view, effects)의 인자로 받아 e.draw(ctx, layout) 호출.
import * as rng from './rng.js';
import { drawMarks } from './render_marks.js';   // 포스트MVP 표식(waypointNum·endMark) — 200줄 분리

const R = () => (rng.next || rng.random || rng.rand || Math.random)();
const NAMES = ['--bg-base', '--bg-card', '--cream-100', '--cream-200', '--cream-400', '--cream-500',
  '--gold-light', '--gold-mid', '--gold-dark', '--ink-warm', '--ink-mid', '--font-mono',
  '--hb-alert', '--hb-halo', '--hb-ghost'];
const keyOf = n => n.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());   // --gold-mid → goldMid

export const T = {};                              // 캔버스 전용 캐시(camelCase 키: goldMid …)
// 부팅 ①: 15개 토큰 1회 읽기 → { '--bg-base': 값, … } 반환(빈 값 검사·console.error·진입 차단은 main).
export function readTokens() {
  const cs = getComputedStyle(document.documentElement), out = {};
  for (const n of NAMES) out[n] = T[keyOf(n)] = cs.getPropertyValue(n).trim();
  return out;
}

// 레이아웃 L — 효과 draw(ctx, L)의 인자. 좌표는 캔버스 로컬 CSS px.
export const layout = { cell: 0, ox: 0, oy: 0, w: 0, h: 0, cssW: 0, cssH: 0, dpr: 1, halo: 0, T, view: null, calls: 0 };
const L = layout;
let board = null, ctx = null, stat = null, sctx = null, level = null, dirty = true, phase = 0, lastCalls = 0;
let halos = [];                                   // head idx별 radialGradient 캐시
const box = { x: 0, y: 0, w: 0, h: 0 };

function getBoard() {
  if (!board && typeof document !== 'undefined') {
    board = document.getElementById('board');
    ctx = board && board.getContext('2d');
  }
  return board;
}
export function resize() { dirty = true; }        // window.resize·visualViewport.resize → 다음 draw에서 재계산

function rebuild(lv) {
  const cw = board.clientWidth, ch = board.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  L.cssW = cw; L.cssH = ch; L.dpr = dpr; L.w = lv.w; L.h = lv.h;
  L.cell = Math.max(0, Math.min((cw - 32) / lv.w, ch / lv.h));
  L.ox = (cw - L.cell * lv.w) / 2; L.oy = (ch - L.cell * lv.h) / 2;
  L.halo = Math.min(1.3 * L.cell, 80);
  if (lv !== level) phase = R() * Math.PI * 2;    // 붓 노이즈 위상: 레벨 진입 시 1회(시드 rng)
  level = lv; halos = []; dirty = false;
  board.width = Math.round(cw * dpr); board.height = Math.round(ch * dpr);
  if (!stat) { stat = document.createElement('canvas'); sctx = stat.getContext('2d'); }
  stat.width = board.width; stat.height = board.height;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.fillStyle = T.bgBase; sctx.fillRect(0, 0, cw, ch); L.calls++;
  paintCells(sctx, lv, L);                        // 정적 레이어 1회 렌더(열린 칸·구멍·벽)
}

// ── 경로 헬퍼(G = {w, cell, ox, oy} — 보드 L 또는 썸네일 레이아웃) ──
const cx = (G, i) => G.ox + (i % G.w + 0.5) * G.cell;
const cy = (G, i) => G.oy + (Math.floor(i / G.w) + 0.5) * G.cell;
function rrect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function cellPath(c, G, i) {
  const x = G.ox + (i % G.w) * G.cell, y = G.oy + Math.floor(i / G.w) * G.cell;
  rrect(c, x + 1, y + 1, G.cell - 2, G.cell - 2, Math.min(4, G.cell * 0.1));
}

// ── 드로잉: openCell · hole · wall · inkPath · halo (+ render_marks: waypointNum · endMark) ──
function openCell(c, G, i) {
  cellPath(c, G, i);
  c.fillStyle = T.cream100; c.fill(); c.strokeStyle = T.cream400; c.lineWidth = 1; c.stroke(); L.calls += 2;
}
function hole(c, G, i) { cellPath(c, G, i); c.fillStyle = T.cream500; c.fill(); L.calls++; }
function wall(c, G, a, b) {
  const col = a % G.w, row = Math.floor(a / G.w);
  c.beginPath();
  if (b === a + 1) { const x = G.ox + (col + 1) * G.cell; c.moveTo(x, G.oy + row * G.cell); c.lineTo(x, G.oy + (row + 1) * G.cell); }
  else { const y = G.oy + (row + 1) * G.cell; c.moveTo(G.ox + col * G.cell, y); c.lineTo(G.ox + (col + 1) * G.cell, y); }
  c.strokeStyle = T.inkMid; c.lineWidth = 3; c.lineCap = 'round'; c.stroke(); L.calls++;
}
function paintCells(c, lv, G) {
  const n = lv.w * lv.h, holes = lv.holes || [];
  for (let i = 0, k = 0; i < n; i++) {
    if (k < holes.length && holes[k] === i) { hole(c, G, i); k++; } else openCell(c, G, i);
  }
  const walls = lv.walls || [];
  for (let j = 0; j < walls.length; j++) wall(c, G, walls[j][0], walls[j][1]);
}
// 잉크: 방문 칸 채움(--gold-light α.35) + 폴리라인 0.28칸(가장자리 --gold-dark, 본체 --gold-mid, ±1.5px 사인 노이즈).
// p = 마지막 구간 채움 비율(push 90ms), ac/ap = pop 흡수 중인 칸과 진행률(70ms).
function inkPath(c, G, path, len, p, ac, ap) {
  if (!path || len < 1) return;
  c.globalAlpha = 0.35; c.fillStyle = T.goldLight;
  for (let i = 0; i < len; i++) { cellPath(c, G, path[i]); c.fill(); L.calls++; }
  c.globalAlpha = 1;
  if (len < 2 && ac < 0) return;
  let px = cx(G, path[0]), py = cy(G, path[0]);
  c.beginPath(); c.moveTo(px, py);
  for (let i = 1; i <= len; i++) {
    let tx, ty, f = 1;
    if (i < len) { tx = cx(G, path[i]); ty = cy(G, path[i]); if (i === len - 1) f = p; }
    else if (ac >= 0) { tx = cx(G, ac); ty = cy(G, ac); f = 1 - ap; }
    else break;
    const dx = (tx - px) * f, dy = (ty - py) * f, sl = Math.hypot(dx, dy) || 1, nx = -dy / sl, ny = dx / sl;
    for (let s = 1; s <= 6; s++) {                  // 구간 양끝 0, 가운데 ±1.5px 사인 요동
      const q = s / 6, o = 1.5 * Math.sin(Math.PI * q) * Math.sin(2 * Math.PI * q + phase + i * 1.7);
      c.lineTo(px + dx * q + nx * o, py + dy * q + ny * o);
    }
    px = tx; py = ty;
  }
  const lw = 0.28 * G.cell;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = T.goldDark; c.lineWidth = lw + 2; c.stroke();
  c.strokeStyle = T.goldMid; c.lineWidth = lw; c.stroke(); L.calls += 2;
}
function halo(c, head) {                          // --hb-halo(α 내장) → 'transparent', 반경 min(1.3칸, 80px)
  let g = halos[head];
  const x = cx(L, head), y = cy(L, head), r = L.halo;
  if (!g) {
    g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, T.hbHalo); g.addColorStop(1, 'transparent'); halos[head] = g;
  }
  c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); L.calls++;
}

// 프레임 렌더: 정적 drawImage 1 → 방문 칸 → 잉크 → 헤일로 → (E·경유점 표식) → 효과.
export function draw(view, effects) {
  if (!getBoard() || !ctx || !view || !view.level) return;
  if (!T.bgBase) readTokens();
  if (dirty || view.level !== level || board.clientWidth !== L.cssW || board.clientHeight !== L.cssH) {
    L.calls = 0; rebuild(view.level);
  }
  if (!L.cssW || !L.cssH) return;
  L.calls = 0; L.view = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.drawImage(stat, 0, 0); L.calls++;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  let p = 1, ac = -1, ap = 0;
  if (effects) for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    if (e.ink === 1) p = e.p; else if (e.ink === -1) { ac = e.cell; ap = e.p; }
  }
  inkPath(ctx, L, view.path, view.len, p, ac, ap);
  if (view.len > 0) halo(ctx, view.head);
  drawMarks(ctx, L, T, view.level, view.path, view.len);
  if (effects) for (let i = 0; i < effects.length; i++) {
    effects[i].draw(ctx, L);
    ctx.globalAlpha = 1; ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  }
  lastCalls = L.calls;
}
export function drawCalls() { return lastCalls; }   // 직전 draw 프레임의 fill/stroke/drawImage 호출 수

// 히트테스트: x·y = 캔버스 로컬 CSS px. mode 'full' = 칸 전체, 'inner' = 내부 70%. 격자 밖 null.
export function cellAt(x, y, mode = 'full') {
  if (!level || !L.cell) return null;
  const gx = (x - L.ox) / L.cell, gy = (y - L.oy) / L.cell, col = Math.floor(gx), row = Math.floor(gy);
  if (col < 0 || row < 0 || col >= L.w || row >= L.h) return null;
  if (mode === 'inner' && (Math.abs(gx - col - 0.5) > 0.35 || Math.abs(gy - row - 0.5) > 0.35)) return null;
  return row * L.w + col;
}
export function cellSize() { return L.cell; }     // input 보간 간격(칸/2)용
export function cellRect(i) {                     // 캔버스 로컬 CSS px(재사용 객체 — 즉시 읽을 것)
  box.x = L.ox + (i % L.w) * L.cell; box.y = L.oy + Math.floor(i / L.w) * L.cell; box.w = box.h = L.cell;
  return box;
}
export function cellCenter(i) {                   // 뷰포트 좌표(getBoundingClientRect 기준)
  if (!getBoard() || !L.cssW) return null;
  const r = board.getBoundingClientRect(), sx = r.width / L.cssW, sy = r.height / L.cssH;
  return { x: r.left + cx(L, i) * sx, y: r.top + cy(L, i) * sy };
}

// 썸네일(로비 팩 카드·도움말·결과·팩 완료 공용): size = 백킹 px 정사각, --cream-200 레터박스.
export function drawStatic(canvas, lv, path, size) {
  if (!T.bgBase) readTokens();
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const c = canvas.getContext('2d'), pad = size * 0.06, cell = (size - 2 * pad) / Math.max(lv.w, lv.h);
  const G = { w: lv.w, h: lv.h, cell, ox: (size - cell * lv.w) / 2, oy: (size - cell * lv.h) / 2 };
  const keep = L.calls;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
  c.fillStyle = T.cream200; c.fillRect(0, 0, size, size);
  paintCells(c, lv, G);
  if (path && path.length) inkPath(c, G, path, path.length, 1, -1, 0);
  drawMarks(c, G, T, lv, path, path ? path.length : 0);
  L.calls = keep;
  return canvas;
}
// 결과 카드 사진: 보드 격자 영역 → 320×320(비정사각은 --cream-200 레터박스).
export function snapshot() {
  const out = document.createElement('canvas'); out.width = out.height = 320;
  const c = out.getContext('2d');
  c.fillStyle = T.cream200 || 'transparent'; c.fillRect(0, 0, 320, 320);
  if (!getBoard() || !level || !L.cell) return out;
  const gw = L.cell * L.w, gh = L.cell * L.h, s = 320 / Math.max(gw, gh), d = L.dpr;
  c.drawImage(board, L.ox * d, L.oy * d, gw * d, gh * d, (320 - gw * s) / 2, (320 - gh * s) / 2, gw * s, gh * s);
  return out;
}
