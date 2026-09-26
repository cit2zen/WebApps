// texture.js — 돌 질감 오프스크린 캐시(§5 에셋 표, §6 분할 예비안: render.js에서 분리)
import { mulberry32 } from './rng.js';
import { col, shade, cacheSize } from './theme.js';

export const TONE = {
  'stone-gray-l': '--doltap-stone-gray', 'stone-gray-d': '--doltap-stone-gray-dk',
  'stone-ochre-l': '--doltap-stone-ochre', 'stone-ochre-d': '--doltap-stone-ochre-dk',
  'stone-slate-l': '--doltap-stone-slate', 'stone-slate-d': '--doltap-stone-slate-dk'};

// 무게중심 기준 로컬 좌표(월드 y-up). 미리보기·피벗·렌더 공통(§5)
export const localOf = s => s.verts.map(([x, y]) => [x - s.cx, y - s.cy]);
export function boundsOf(V) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of V) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}
// 반시계 볼록 다각형 내부(경계 포함)
export function inside(V, x, y) {
  for (let i = 0; i < V.length; i++) {
    const [ax, ay] = V[i], [bx, by] = V[(i + 1) % V.length];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}

// 반점·이끼 배치(결정적). 스트림 mulberry32((seed ^ (i*0x9E3779B1)) >>> 0)
// 반점: 개수 18+floor(u·13) → 각 반점 (x u, y u) 거절 샘플링 → 반지름 0.8+u·1.2 → 명도 (2u−1)·8
// 이끼: 반점 다음에 이어서, 윗면 상위 30% 높이 띠 안 거절 샘플링, 반지름 2.5
export function speckles(seed, s) {
  const u = mulberry32((seed ^ (s.i * 0x9E3779B1)) >>> 0);
  const V = localOf(s), b = boundsOf(V), w = b.maxX - b.minX, h = b.maxY - b.minY;
  const pick = (y0, y1) => {
    for (let t = 0; t < 200; t++) {
      const x = b.minX + u() * w, y = y0 + u() * (y1 - y0);
      if (inside(V, x, y)) return [x, y];
    }
    return [0, 0];
  };
  const dots = [], moss = [], n = 18 + Math.floor(u() * 13);
  for (let k = 0; k < n; k++) {
    const [x, y] = pick(b.minY, b.maxY);
    dots.push({ x, y, r: 0.8 + u() * 1.2, dl: (2 * u() - 1) * 8 });
  }
  for (let k = 0; k < s.moss; k++) {
    const [x, y] = pick(b.maxY - 0.3 * h, b.maxY);
    moss.push({ x, y, r: 2.5 });
  }
  return { dots, moss };
}

const cache = new Map();   // key `${seed}:${i}` → {cs, cv, minX, maxY}
export const cacheCount = () => cache.size;
export function clearTextures() { cache.clear(); }

export function texture(seed, s, cs) {
  const key = `${seed}:${s.i}`;
  const hit = cache.get(key);
  if (hit && hit.cs === cs) return hit;
  const V = localOf(s), b = boundsOf(V);
  const cv = document.createElement('canvas');
  cv.width = cacheSize(b.maxX - b.minX, cs);
  cv.height = cacheSize(b.maxY - b.minY, cs);
  const g = cv.getContext('2d');
  g.setTransform(cs, 0, 0, -cs, -b.minX * cs + 2, b.maxY * cs + 2);   // 로컬 y-up → 캐시 y-down
  const base = col(TONE[s.tone] || '--doltap-stone-gray');
  const path = new Path2D();
  V.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  g.fillStyle = base;
  g.fill(path);
  g.save();
  g.clip(path);
  const { dots, moss } = speckles(seed, s);
  for (const d of dots) { g.fillStyle = shade(base, d.dl); disc(g, d.x, d.y, d.r); }
  g.fillStyle = col('--doltap-moss');
  for (const m of moss) disc(g, m.x, m.y, m.r);
  edges(g, V, n => n > 0.3, shade(base, 14), 2 / cs);        // 윗가장자리 1px 하이라이트(클립으로 절반)
  edges(g, V, n => n < -0.3, 'rgba(26,16,5,0.28)', 6 / cs);  // 아래 그림자 3px
  g.restore();
  g.strokeStyle = col('--ink-warm');
  g.lineWidth = 1.2;
  g.lineJoin = 'round';
  g.stroke(path);
  const t = { cs, cv, minX: b.minX, maxY: b.maxY };
  cache.set(key, t);
  return t;
}
function disc(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
// 바깥 법선의 y 성분(반시계 → 법선 (dy,−dx)/len)으로 윗변·아랫변을 고른다
function edges(g, V, want, color, lw) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  for (let i = 0; i < V.length; i++) {
    const [ax, ay] = V[i], [bx, by] = V[(i + 1) % V.length];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    if (want(-(bx - ax) / len)) { g.moveTo(ax, ay); g.lineTo(bx, by); }
  }
  g.stroke();
}
