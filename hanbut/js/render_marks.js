// render_marks.js — 포스트MVP 표식(§5 드로잉 표): 경유점 번호(waypointNum) · 끝 칸 E(endMark).
// render.js가 import(render.js 200줄 상한 분리, §6). 색·폰트는 render의 토큰 캐시 T만(hex 금지).
// G = {w, cell, ox, oy, calls?} — 보드 레이아웃 L 또는 썸네일 레이아웃.

const cx = (G, i) => G.ox + (i % G.w + 0.5) * G.cell;
const cy = (G, i) => G.oy + (Math.floor(i / G.w) + 0.5) * G.cell;
const tally = (G, k) => { if (typeof G.calls === 'number') G.calls += k; };

/** 경유점 번호: --font-mono · --ink-warm. passed = 이미 지난 경유점(globalAlpha 0.35로 흐리게). */
export function waypointNum(c, G, T, i, num, passed = false) {
  if (passed) c.globalAlpha = 0.35;
  c.fillStyle = T.inkWarm; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${Math.round(G.cell * 0.32)}px ${T.fontMono}`;
  c.fillText(String(num), cx(G, i), cy(G, i)); tally(G, 1);
  c.globalAlpha = 1;
}

/** 끝 칸 E: 칸 안쪽 이중 사각 테두리(--ink-mid 2px · --gold-dark 1px) — 마지막 칸으로만 진입 가능(규칙 6). */
export function endMark(c, G, T, i) {
  const s = G.cell, x = G.ox + (i % G.w) * s, y = G.oy + Math.floor(i / G.w) * s;
  c.lineWidth = 2; c.strokeStyle = T.inkMid;
  c.strokeRect(x + s * 0.16, y + s * 0.16, s * 0.68, s * 0.68);
  c.lineWidth = 1; c.strokeStyle = T.goldDark;
  c.strokeRect(x + s * 0.26, y + s * 0.26, s * 0.48, s * 0.48); tally(G, 2);
}

/** 레벨 표식 일괄: E 테두리 → 경유점 번호(1..Y). path/len = 현재 경로(지난 경유점 판정, 썸네일은 생략). */
export function drawMarks(c, G, T, lv, path, len = 0) {
  if (lv.end !== null && lv.end !== undefined) endMark(c, G, T, lv.end);
  const wp = lv.waypoints;
  if (!wp || !wp.length) return;
  for (let j = 0; j < wp.length; j++) {
    let passed = false;
    if (path) for (let k = 0; k < len; k++) if (path[k] === wp[j]) { passed = true; break; }
    waypointNum(c, G, T, wp[j], j + 1, passed);
  }
}
