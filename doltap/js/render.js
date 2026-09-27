// render.js — 돌 Path2D·drawStone(질감 캐시)·불안정 외곽선·drawStoneThumb·drawRockMini·drawRock (§4 공용 export)
import { col, cacheScale } from './theme.js';
import { texture, localOf, boundsOf, TONE, cacheCount, clearTextures } from './texture.js';

export { cacheCount, clearTextures, localOf, boundsOf };
// 규칙 5 너럭바위 꼭짓점(월드, y-up). 이끼 패치 x = 120/165/230/270, 윗면 6px 아래, r 7
export const ROCK = [[95, -6], [135, -2], [195, 0], [255, -2], [295, -6], [280, -150], [110, -150]];
const TOP = ROCK.slice(0, 5);
const MOSS_X = [120, 165, 230, 270];

// P = {k, ox, base, camOff, w, h}: sx = ox + x·k, sy = base − (y − camOff)·k (§6 런타임 좌표 규약)
export const sx = (P, x) => P.ox + x * P.k;
export const sy = (P, y) => P.base - (y - P.camOff) * P.k;

// 바위 윗면 높이(월드 y) — 윗변 5점 선형 보간
export function rockTop(x) {
  for (let i = 0; i < TOP.length - 1; i++) {
    const [ax, ay] = TOP[i], [bx, by] = TOP[i + 1];
    if (x >= ax && x <= bx) return ay + (by - ay) * (x - ax) / (bx - ax);
  }
  return -6;
}

const paths = new WeakMap();
// 로컬(무게중심 기준, y-up) 단위 Path2D — 돌마다 1개
export function pathOf(stone) {
  let p = paths.get(stone);
  if (!p) {
    p = new Path2D();
    localOf(stone).forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    paths.set(stone, p);
  }
  return p;
}

// 질감 캐시 drawImage. ang = 화면 시계 방향 + 라디안(Matter body.angle = aDeg·π/180)
export function drawStone(ctx, P, stone, seed, x, y, ang) {
  const cs = cacheScale(P.k), t = texture(seed, stone, cs), f = P.k / cs;
  ctx.save();
  ctx.translate(sx(P, x), sy(P, y));
  ctx.rotate(ang);
  ctx.drawImage(t.cv, t.minX * P.k - 2 * f, -t.maxY * P.k - 2 * f, t.cv.width * f, t.cv.height * f);
  ctx.restore();
}

// 외곽선만(불안정 4Hz 깜빡임 등)
export function drawOutline(ctx, P, stone, x, y, ang, color, lw = 2) {
  ctx.save();
  ctx.translate(sx(P, x), sy(P, y));
  ctx.rotate(ang);
  ctx.scale(P.k, -P.k);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw / P.k;
  ctx.stroke(pathOf(stone));
  ctx.restore();
}

// box = {x, y, w, h}(css px). 회전 없이 톤 단색 + 외곽선으로 칸 안에 맞춘다(로비·도움말·미리보기 40×40)
export function drawStoneThumb(ctx, stone, box) {
  const b = boundsOf(localOf(stone)), pad = 2;
  const sc = Math.min((box.w - 2 * pad) / (b.maxX - b.minX), (box.h - 2 * pad) / (b.maxY - b.minY));
  ctx.save();
  ctx.translate(box.x + box.w / 2 - (b.minX + b.maxX) / 2 * sc, box.y + box.h / 2 + (b.minY + b.maxY) / 2 * sc);
  ctx.scale(sc, -sc);
  ctx.fillStyle = col(TONE[stone.tone] || '--doltap-stone-gray');
  ctx.fill(pathOf(stone));
  ctx.strokeStyle = col('--ink-warm');
  ctx.lineWidth = 1 / sc;
  ctx.stroke(pathOf(stone));
  ctx.restore();
}

function rockPath(tx, ty) {
  const p = new Path2D();
  ROCK.forEach(([x, y], i) => (i ? p.lineTo(tx(x), ty(y)) : p.moveTo(tx(x), ty(y))));
  p.closePath();
  return p;
}
function mossPatches(ctx, tx, ty, r) {
  ctx.fillStyle = col('--doltap-moss');
  for (const x of MOSS_X) { ctx.beginPath(); ctx.arc(tx(x), ty(rockTop(x) - 6), r, 0, Math.PI * 2); ctx.fill(); }
}

// 인게임 바위: 바 전체 사각형(y = base..h) 먼저 → 다각형 → 이끼(다각형 클립)
export function drawRock(ctx, P) {
  const rock = col('--doltap-rock');
  ctx.fillStyle = rock;
  ctx.fillRect(P.ox, P.base, 390 * P.k, P.h - P.base);
  const path = rockPath(x => sx(P, x), y => sy(P, y));
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  mossPatches(ctx, x => sx(P, x), y => sy(P, y), 7 * P.k);
  ctx.restore();
}

// 미니 너럭바위: 폭 200을 box 폭에 맞추고 윗면을 box 위쪽 1/3에 둔다
export function drawRockMini(ctx, box) {
  const sc = box.w / 220, tx = x => box.x + (x - 85) * sc, ty = y => box.y + box.h / 3 - y * sc;
  const path = rockPath(tx, ty);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.fillStyle = col('--doltap-rock');
  ctx.fill(path);
  ctx.clip(path);
  mossPatches(ctx, tx, ty, 7 * sc);
  ctx.restore();
}
