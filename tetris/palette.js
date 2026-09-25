// palette.js — 캔버스 색은 style.css :root(--tt-*)의 Polaroid 팔레트에서 읽는다 (JS에 색 리터럴 없음).
const cache = new Map();

export function css(name) {
  let v = cache.get(name);
  if (!v) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) cache.set(name, v);
  }
  return v;
}
