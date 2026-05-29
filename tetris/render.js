// render.js — canvas drawing with neon color blocks, glow, and effects overlay

import { ROWS, COLS, SHAPES, COLORS, cellsOf } from './piece.js';

const CELL = 28;

function block(ctx, px, py, size, color, glow) {
  if (glow) {
    ctx.shadowColor = color.glow;
    ctx.shadowBlur = size * 0.5;
  }
  const grad = ctx.createLinearGradient(px, py, px, py + size);
  grad.addColorStop(0, color.light);
  grad.addColorStop(0.32, color.base);
  grad.addColorStop(1, color.glow);
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, size, size);
  ctx.shadowBlur = 0;
  // bevel highlights
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(px, py, size, Math.max(2, size * 0.12));
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(px, py, Math.max(2, size * 0.12), size);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(px, py + size - Math.max(2, size * 0.12), size, Math.max(2, size * 0.12));
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

function overlay(ctx, text, sub) {
  ctx.fillStyle = 'rgba(8,7,18,0.78)';
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fef9c3';
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 18;
  ctx.font = '700 30px "Press Start 2P", monospace';
  ctx.fillText(text, (COLS * CELL) / 2, (ROWS * CELL) / 2 - 14);
  ctx.shadowBlur = 0;
  if (sub) {
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '12px "Chivo Mono", monospace';
    ctx.fillText(sub, (COLS * CELL) / 2, (ROWS * CELL) / 2 + 24);
  }
}

function drawBoard(ctx, g) {
  ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);
  // playfield backdrop
  ctx.fillStyle = 'rgba(10,8,24,0.55)';
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
  ctx.strokeStyle = 'rgba(120,110,200,0.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
  }
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (g.grid[y][x]) block(ctx, x * CELL, y * CELL, CELL, COLORS[g.grid[y][x]], true);
  if (g.current && g.state !== 'over')
    for (const [x, y] of cellsOf(g.current))
      if (y >= 0) block(ctx, x * CELL, y * CELL, CELL, COLORS[g.current.type], true);
}

function drawMini(ctx, type, areaX, areaY, areaW, size) {
  const cells = SHAPES[type][0];
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys);
  const pw = (maxX - minX + 1) * size;
  const ox = areaX + (areaW - pw) / 2 - minX * size;
  const oy = areaY - minY * size;
  for (const [cx, cy] of cells)
    block(ctx, ox + cx * size, oy + cy * size, size, COLORS[type], true);
}

export function render(ctx, g, holdCtx, nextCtx, effects) {
  drawBoard(ctx, g);
  effects.draw(ctx);
  if (g.state === 'paused') overlay(ctx, 'PAUSE', 'press P to resume');
  if (g.state === 'over') overlay(ctx, 'GAME OVER', 'press R to restart');

  holdCtx.clearRect(0, 0, holdCtx.canvas.width, holdCtx.canvas.height);
  if (g.hold) drawMini(holdCtx, g.hold, 0, 20, holdCtx.canvas.width, 20);

  nextCtx.clearRect(0, 0, nextCtx.canvas.width, nextCtx.canvas.height);
  for (let i = 0; i < 3; i++)
    if (g.queue[i]) drawMini(nextCtx, g.queue[i], 0, 20 + i * 62, nextCtx.canvas.width, 18);
}
