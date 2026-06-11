// effects.js — particle bursts on line clears + floating score/combo text

import { COLORS } from './piece.js';

const CELL = 28;
const BOARD_W = 10 * CELL;
const BOARD_H = 20 * CELL;

export function createEffects() {
  const particles = [];
  const texts = [];
  let flash = 0; // white screen flash intensity 0..1

  function burst(rows, big) {
    for (const { y, cells } of rows) {
      for (let x = 0; x < cells.length; x++) {
        const c = COLORS[cells[x]] || COLORS.I;
        const count = big ? 5 : 3;
        for (let k = 0; k < count; k++) {
          particles.push({
            x: (x + 0.5) * CELL,
            y: (y + 0.5) * CELL,
            vx: (Math.random() - 0.5) * 0.32,
            vy: (Math.random() - 0.7) * 0.34,
            life: 1,
            decay: 0.0014 + Math.random() * 0.0012,
            size: 3 + Math.random() * 4,
            color: c.light,
          });
        }
      }
    }
    flash = Math.min(1, flash + (big ? 0.9 : 0.45));
  }

  function text(str, color) {
    texts.push({ str, color, x: BOARD_W / 2, y: BOARD_H * 0.4, life: 1 });
  }

  function update(dt) {
    const f = dt / 16.67;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0011 * dt; // gravity
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.y -= 0.45 * f;
      t.life -= 0.012 * f;
      if (t.life <= 0) texts.splice(i, 1);
    }
    if (flash > 0) flash = Math.max(0, flash - 0.05 * f);
  }

  function draw(ctx) {
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.28})`;
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    }
    ctx.save();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      const s = p.size * p.life;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, t.life * 1.6);
      ctx.font = '700 24px "Space Mono", ui-monospace, monospace';
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 16;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }

  return { burst, text, update, draw, get active() { return particles.length + texts.length > 0 || flash > 0; } };
}
