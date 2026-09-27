// theme.js — 토큰 읽기(누락 warn 1회)·fs-probe px·캔버스 폰트·fitCanvas(dpr≤2)·캐시 배율 cs (§4·§6 정합 #6·#7)
export const DOLTAP = [
  '--doltap-stone-gray', '--doltap-stone-gray-dk', '--doltap-stone-ochre', '--doltap-stone-ochre-dk',
  '--doltap-stone-slate', '--doltap-stone-slate-dk', '--doltap-moss',
  '--doltap-sky-dawn', '--doltap-sky-day', '--doltap-sky-dusk', '--doltap-sky-glow',
  '--doltap-ridge-far', '--doltap-ridge-mid', '--doltap-ridge-near', '--doltap-rock',
  '--doltap-ribbon-blue', '--doltap-ribbon-red', '--doltap-ribbon-yellow', '--doltap-ribbon-white',
  '--doltap-ribbon-black', '--doltap-dust'];
export const SHARED = [
  '--bg-base', '--bg-card', '--bg-overlay', '--cream-300', '--ink-warm', '--ink-muted',
  '--gold-mid', '--gold-light', '--gold-text', '--gold-dark', '--pol-danger', '--pol-danger-line',
  '--font-display', '--font-label', '--font-mono', '--fs-2xs', '--fs-xl', '--fs-hero',
  '--r-md', '--shadow-soft', '--focus-ring', '--dur-fast'];
const SKY = ['--doltap-sky-dawn', '--doltap-sky-day', '--doltap-sky-dusk', '--doltap-sky-glow'];
const T = { c: {}, heroPx: 48, safeTop: 0 };
let warned = false;

const cssGet = n => getComputedStyle(document.documentElement).getPropertyValue(n);
function probePx() {
  let p = document.querySelector('.fs-probe');
  if (!p) {
    p = document.createElement('span');
    p.className = 'fs-probe';
    p.setAttribute('aria-hidden', 'true');
    document.body.appendChild(p);
  }
  return parseFloat(getComputedStyle(p).fontSize) || 48;
}
function readSafeTop() {
  const el = document.getElementById('lobby') || document.getElementById('boot');
  return el ? parseFloat(getComputedStyle(el).paddingTop) || 0 : 0;
}

// 부트·resize 때 호출. get/probe/safe는 Node 테스트용 주입 지점
export function loadTheme(get = cssGet, probe = probePx, safe = readSafeTop) {
  const miss = [];
  for (const n of [...DOLTAP, ...SHARED]) {
    const v = String(get(n) ?? '').trim();
    T.c[n] = v;
    if (!v) miss.push(n);
  }
  if (miss.length && !warned) { warned = true; console.warn('doltap: 빈 토큰 ' + miss.join(' ')); }
  T.heroPx = probe();
  T.safeTop = safe();
  return T;
}

export const col = n => T.c[n] || '#000000';
export const heroPx = () => T.heroPx;
export const safeTop = () => T.safeTop;
export const font = (kind, px) => `${Math.round(px)}px ${T.c[kind === 'mono' ? '--font-mono' : '--font-label']}`;
export const dpr = () => Math.min(globalThis.devicePixelRatio || 1, 2);

// backing = css × min(dpr,2), setTransform(dpr) 적용 뒤 ctx 반환
export function fitCanvas(cv, w, h) {
  const d = dpr(), bw = Math.round(w * d), bh = Math.round(h * d);
  if (cv.width !== bw) cv.width = bw;
  if (cv.height !== bh) cv.height = bh;
  const ctx = cv.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return ctx;
}

// 캐시 배율 cs = min(k·min(dpr,2), 2.4), 캐시 한 변 = ceil(extent·cs)+4 (≤ 280)
export const cacheScale = (k, d = dpr()) => Math.min(k * Math.min(d, 2), 2.4);
export const cacheSize = (extent, cs) => Math.ceil(extent * cs) + 4;

export function hexRgb(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [v >> 16 & 255, v >> 8 & 255, v & 255];
}
const hx = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
export function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b), u = Math.max(0, Math.min(1, t));
  return '#' + A.map((v, i) => hx(v + (B[i] - v) * u)).join('');
}
// 하늘: 0/150/300/450cm 정지점 사이 선형 보간, 450cm 이상 glow 고정
export function skyAt(cm) {
  const c = Math.max(0, cm), i = Math.min(Math.floor(c / 150), 3);
  if (i >= 3) return col(SKY[3]).toLowerCase();
  return mixHex(col(SKY[i]), col(SKY[i + 1]), (c - i * 150) / 150);
}
// HSL 명도 ±dl %p 조정(돌 반점) — "#rrggbb" → "hsl(h s% l%)"
export function shade(hex, dl) {
  const [r, g, b] = hexRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let hh = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  }
  const L = Math.max(0, Math.min(100, l * 100 + dl));
  return `hsl(${Math.round(hh * 60 + 360) % 360} ${(s * 100).toFixed(1)}% ${L.toFixed(1)}%)`;
}
