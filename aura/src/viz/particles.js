// 레이어 C: 미감 우선 파티클 — 종이 위 잉크 티끌.
// 보케(옅은 안료 얼룩) + 점/혜성 스트릭/4점 글린트, 팔레트 2색(a↔b) 하모니로 색을 정돈.
// kind: 0=dot, 1=streak(혜성), 2=glint(별빛)
import { mix, rgba } from './color.js';

// a와 b 사이 보간 비율 + 약간의 지터 → 두 색의 하모니. 색은 그릴 때 현재 팔레트로 계산.
function harmonize(k, jitter = 0.1) {
  const v = k + (Math.random() * 2 - 1) * jitter;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class Particles {
  constructor(max = 1300) {
    this.max = max;
    this.p = [];
    this.bokeh = null;
    this._prevLevel = 0;
    this._amb = 0;
  }

  _initBokeh(w, h) {
    this.bokeh = Array.from({ length: 16 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9,
      r: 46 + Math.random() * 110, hk: Math.random(), ph: Math.random() * 6.28,
    }));
  }

  _spawn(x, y, vx, vy, life, hue, size, kind, orb) {
    if (this.p.length >= this.max) return;
    this.p.push({
      x, y, vx, vy, life, maxLife: life, hue, size, kind,
      orb, spin: (Math.random() - 0.5) * 2, seed: Math.random() * 6.28,
    });
  }

  burst(cx, cy, level, palette) {
    const n = Math.floor(70 + level * 230);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 55 + Math.random() * 210;
      const sp = (0.7 + Math.random() * 3.2) * (60 + level * 270);
      const roll = Math.random();
      const kind = roll < 0.24 ? 1 : roll < 0.34 ? 2 : 0;
      this._spawn(
        cx + Math.cos(a) * rr, cy + Math.sin(a) * rr,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.7 + Math.random() * 1.3,
        harmonize(Math.random(), 0.14),
        kind === 2 ? 1.5 + Math.random() * 2.0 : 0.9 + Math.random() * 2.4,
        kind, false,
      );
    }
  }

  feed(cx, cy, level, palette, dt) {
    if (level - this._prevLevel > 0.13 && level > 0.38) this.burst(cx, cy, level, palette);
    this._prevLevel = level;
    this._amb += dt;
    const interval = 0.007 + (1 - level) * 0.02;
    while (this._amb > interval) {
      this._amb -= interval;
      const a = Math.random() * Math.PI * 2;
      const rad = 36 + Math.random() * 130;
      const sp = 9 + Math.random() * 28 + level * 50;
      const kind = Math.random() < 0.1 ? 2 : 0;
      this._spawn(
        cx + Math.cos(a) * rad, cy + Math.sin(a) * rad,
        Math.cos(a) * sp, Math.sin(a) * sp,
        1.8 + Math.random() * 2.4,
        harmonize(Math.random(), 0.12),
        kind === 2 ? 1.0 + Math.random() * 1.3 : 0.5 + Math.random() * 1.6,
        kind, true,
      );
    }
  }

  // 보케: 크고 매우 옅은 안료 얼룩이 화면을 천천히 표류(심도/몽환감).
  _drawBokeh(ctx, w, h, palette, dt, t) {
    if (!this.bokeh) this._initBokeh(w, h);
    for (const b of this.bokeh) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -b.r) b.x = w + b.r; else if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r; else if (b.y > h + b.r) b.y = -b.r;
      const c = mix(palette.a, palette.b, b.hk);
      const al = 0.045 + 0.025 * Math.sin(t * 0.5 + b.ph);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgba(c, al));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // layers.wash = 보케(매 프레임 새로), layers.trail = 티끌·혜성·글린트(잔상).
  draw(layers, w, h, frame) {
    const { dt, palette, level, t } = frame;
    const ctx = layers.trail;
    const cx = w / 2, cy = h / 2;
    this.feed(cx, cy, level, palette, dt);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'source-over';
    layers.wash.save();
    this._drawBokeh(layers.wash, w, h, palette, dt, t);
    layers.wash.restore();

    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt;
      if (q.life <= 0) { this.p.splice(i, 1); continue; }
      if (q.orb) {
        const dx = q.x - cx, dy = q.y - cy;
        q.vx += -dy * q.spin * 0.55 * dt;
        q.vy += dx * q.spin * 0.55 * dt;
        q.vx *= 0.99; q.vy *= 0.99;
      } else {
        q.vx *= 0.975; q.vy *= 0.975;
        q.vy += 8 * dt;
      }
      q.x += q.vx * dt; q.y += q.vy * dt;

      const k = q.life / q.maxLife;
      const tw = 0.55 + 0.45 * Math.sin(t * 18 + q.seed);
      const col = mix(palette.a, palette.b, q.hue);

      if (q.kind === 1) {
        // 혜성: 길고 우아한 꼬리, 머리는 또렷.
        const px = q.x - q.vx * 0.08, py = q.y - q.vy * 0.08;
        const g = ctx.createLinearGradient(px, py, q.x, q.y);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(1, rgba(col, k * 0.5));
        ctx.strokeStyle = g;
        ctx.lineWidth = q.size * 0.85;
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(q.x, q.y);
        ctx.stroke();
      } else if (q.kind === 2) {
        // 별빛 글린트: 길고 가는 4갈래 + 부드러운 코어.
        const L = q.size * (4.5 + 4 * tw) * (0.4 + k);
        const gs = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, L);
        const gc = mix(col, palette.ink, 0.2);
        gs.addColorStop(0, rgba(gc, k * 0.5 * tw));
        gs.addColorStop(1, rgba(gc, 0));
        ctx.strokeStyle = gs;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(q.x - L, q.y); ctx.lineTo(q.x + L, q.y);
        ctx.moveTo(q.x, q.y - L); ctx.lineTo(q.x, q.y + L);
        ctx.stroke();
        ctx.fillStyle = rgba(gc, k * 0.7 * tw);
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 점: 부드러운 잉크 티끌(워시가 번짐 담당) + 큰 입자엔 진한 잉크 심.
        const s = q.size * (0.45 + k * 0.85);
        ctx.fillStyle = rgba(col, k * 0.6 * tw);
        ctx.beginPath();
        ctx.arc(q.x, q.y, s, 0, Math.PI * 2);
        ctx.fill();
        if (q.size > 1.7) {
          ctx.fillStyle = rgba(mix(col, palette.ink, 0.5), k * 0.45);
          ctx.beginPath();
          ctx.arc(q.x, q.y, s * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}
