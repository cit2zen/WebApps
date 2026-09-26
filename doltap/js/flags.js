// flags.js — 50cm 목표 깃발·오방색 리본(1.6Hz)·가이드 깃발 3종·라벨 fillText·100/200/300/400 팝업 (§2 규칙 14, §4·§5)
import { col, font, heroPx } from './theme.js';
import strings from './strings.js';
import { fmt } from './dom.js';

const RIB = ['--doltap-ribbon-blue', '--doltap-ribbon-red', '--doltap-ribbon-yellow',
  '--doltap-ribbon-white', '--doltap-ribbon-black'];
const GUIDE = { best: '--ink-muted', today: '--gold-mid', friend: '--gold-dark' };
const POLE_X = 372, POLE_LEN = 36, LABEL_PX = 11, POP_MS = 900;
let pops = [];

// 캔버스 글자의 유일한 경로(§6 보안 규칙)
export function label(ctx, str, x, y, f) {
  ctx.font = f;
  ctx.fillText(String(str), x, y);
}
export const cmY = cm => cm * 2;                                   // 1px = 0.5cm
export const goalCm = maxH => (Math.floor(maxH / 50) + 1) * 50;    // 다음 50cm 목표
export function reachedCms(maxH) {
  const out = [];
  for (let c = 50; c <= maxH; c += 50) out.push(c);
  return out;
}
// 이번 판 최고가 prev → next로 오를 때 새로 넘은 팝업 높이(100·200·300·400)
export const crossed = (prev, next) => [100, 200, 300, 400].filter(c => prev < c && next >= c);

export function popup(cm, now) { pops.push({ cm, t0: now }); }
export function reset() { pops = []; }
export const popCount = () => pops.length;

const px = (Q, x) => Q.ox + x * Q.k;
const py = (Q, y) => Q.base - (y - Q.camOff) * Q.k;
const onScreen = (Q, y) => { const s = py(Q, y); return s > -60 && s < Q.h + 60; };

function pole(ctx, Q, y) {
  ctx.strokeStyle = col('--ink-warm');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px(Q, POLE_X), py(Q, y));
  ctx.lineTo(px(Q, POLE_X), py(Q, y - POLE_LEN));
  ctx.stroke();
}

function ribbon(ctx, Q, y, t) {
  pole(ctx, Q, y);
  const x0 = px(Q, POLE_X), y0 = py(Q, y), len = 18 * Q.k;
  ctx.lineWidth = 3 * Q.k;
  RIB.forEach((c, j) => {
    const yy = y0 + (2 + j * 3.2) * Q.k, wave = 4 * Q.k * Math.sin(2 * Math.PI * 1.6 * t + j * 0.8);
    ctx.strokeStyle = col(c);
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.quadraticCurveTo(x0 - len / 2, yy + wave / 2, x0 - len, yy + wave);
    ctx.stroke();
  });
}

function target(ctx, Q, cm) {
  const y = cmY(cm);
  ctx.save();
  ctx.globalAlpha = 0.35;
  pole(ctx, Q, y);
  ctx.fillStyle = col('--gold-mid');
  ctx.beginPath();
  ctx.moveTo(px(Q, POLE_X), py(Q, y));
  ctx.lineTo(px(Q, POLE_X - 22), py(Q, y - 7));
  ctx.lineTo(px(Q, POLE_X), py(Q, y - 14));
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'right';
  label(ctx, cm, px(Q, POLE_X - 26), py(Q, y - 11), font('mono', LABEL_PX));
  ctx.restore();
}

function guide(ctx, Q, g) {
  const y = py(Q, cmY(g.cm)), c = col(GUIDE[g.kind]);
  ctx.save();
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(px(Q, 0), y);
  ctx.lineTo(px(Q, 390), y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  const x = px(Q, 8), ty = y - 4;
  if (g.kind === 'friend') {
    label(ctx, fmt(strings.hud.flagFriend, { F: g.cm.toFixed(1) }), x, ty, font('label', LABEL_PX));
  } else {
    const txt = g.kind === 'best' ? strings.hud.flagBest : strings.hud.flagToday;
    label(ctx, txt, x, ty, font('label', LABEL_PX));
    const w = ctx.measureText(txt).width;
    label(ctx, g.cm.toFixed(1), x + w + 6, ty, font('mono', LABEL_PX));
  }
  ctx.restore();
}

// st = {maxH, guides:[{kind:'best'|'today'|'friend', cm}], t(초)} — 돌보다 먼저 그린다
export function draw(ctx, Q, st) {
  for (const g of st.guides) if (g.cm > 0 && onScreen(Q, cmY(g.cm))) guide(ctx, Q, g);
  let n = 0;
  for (const cm of reachedCms(st.maxH)) {
    if (n < 12 && onScreen(Q, cmY(cm))) { ribbon(ctx, Q, cmY(cm), st.t); n++; }
  }
  const g = goalCm(st.maxH);
  if (onScreen(Q, cmY(g))) target(ctx, Q, g);
}

// 마일스톤 팝업: --fs-hero(probe px)·--font-mono·--gold-text, 900ms 동안 40px 떠오르며 페이드
export function drawPopups(ctx, Q, now) {
  pops = pops.filter(p => now - p.t0 < POP_MS);
  if (!pops.length) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = col('--gold-text');
  for (const p of pops) {
    const a = Math.max(0, (now - p.t0) / POP_MS);
    ctx.globalAlpha = 1 - a;
    label(ctx, fmt(strings.hud.milestone, { h: p.cm }), px(Q, 195), py(Q, cmY(p.cm)) - 12 - 40 * a,
      font('mono', heroPx()));
  }
  ctx.restore();
}
