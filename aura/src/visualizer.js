import { drawSpectrum } from './viz/spectrum.js';
import { drawFluid } from './viz/fluid.js';
import { Particles } from './viz/particles.js';
import { Bloom } from './viz/bloom.js';

// 상태=감정. bg는 배경 라디얼(rgb), h/h2는 발광 색상, glow/blur는 블룸 강도, fade는 잔상.
const PALETTES = {
  idle:      { bg0: [7, 11, 24], bg1: [2, 3, 9],   h: 202, h2: 188, sat: 68, light: 56, glow: 0.42, blur: 16, fade: 0.06 },
  listening: { bg0: [4, 18, 28], bg1: [1, 6, 13],  h: 176, h2: 196, sat: 88, light: 62, glow: 0.55, blur: 14, fade: 0.08 },
  thinking:  { bg0: [13, 9, 30], bg1: [4, 2, 13],  h: 260, h2: 282, sat: 76, light: 60, glow: 0.52, blur: 18, fade: 0.055 },
  speaking:  { bg0: [28, 9, 20], bg1: [11, 3, 9],  h: 340, h2: 16,  sat: 84, light: 64, glow: 0.62, blur: 15, fade: 0.075 },
};

function lerpHue(a, b, k) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * k + 360) % 360;
}

export class Visualizer {
  constructor(ctx) {
    this.ctx = ctx;
    this.bloom = new Bloom(0.5);
    this.particles = new Particles();
    this.phase = 'idle';
    this.cur = { ...PALETTES.idle, bg0: [...PALETTES.idle.bg0], bg1: [...PALETTES.idle.bg1] };
    this.t = 0;
    this.source = () => ({ level: 0, spectrum: null });
  }

  setPhase(p) { this.phase = p; }
  setSource(fn) { this.source = fn; }
  resize(w, h) { this.bloom.resize(w, h); }

  _lerp(dt) {
    const tgt = PALETTES[this.phase] || PALETTES.idle;
    const k = Math.min(1, dt * 2.2);
    this.cur.h = lerpHue(this.cur.h, tgt.h, k);
    this.cur.h2 = lerpHue(this.cur.h2, tgt.h2, k);
    for (const key of ['sat', 'light', 'glow', 'blur', 'fade']) {
      this.cur[key] += (tgt[key] - this.cur[key]) * k;
    }
    for (let i = 0; i < 3; i++) {
      this.cur.bg0[i] += (tgt.bg0[i] - this.cur.bg0[i]) * k;
      this.cur.bg1[i] += (tgt.bg1[i] - this.cur.bg1[i]) * k;
    }
  }

  _background(w, h) {
    const ctx = this.ctx;
    const p = this.cur;
    const cx = w * (0.5 + 0.06 * Math.sin(this.t * 0.13));
    const cy = h * (0.46 + 0.05 * Math.cos(this.t * 0.11));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
    const c0 = p.bg0, c1 = p.bg1;
    g.addColorStop(0, `rgb(${c0[0] | 0},${c0[1] | 0},${c0[2] | 0})`);
    g.addColorStop(1, `rgb(${c1[0] | 0},${c1[1] | 0},${c1[2] | 0})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  render(dt, w, h) {
    this.t += dt;
    this._lerp(dt);

    let { level, spectrum } = this.source();
    if (this.phase === 'idle') level = 0.16 + 0.07 * Math.sin(this.t * 1.2);
    if (this.phase === 'thinking') level = 0.30 + 0.13 * Math.sin(this.t * 2.6);

    this._background(w, h);

    const s = this.bloom.begin(this.cur.fade);
    const frame = { level, spectrum, palette: this.cur, t: this.t, dt, w, h };
    drawFluid(s, w, h, frame);
    drawSpectrum(s, w, h, frame);
    this.particles.draw(s, w, h, frame);
    this._core(s, w, h, frame);

    this.bloom.composite(this.ctx, this.cur.blur, this.cur.glow);
  }

  // 중앙 오로라 코어 — 음성 진폭으로 맥동하는 발광 초점(블룸으로 번짐). 고급감의 중심.
  _core(s, w, h, frame) {
    const p = frame.palette, lvl = frame.level;
    const cx = w * 0.5, cy = h * 0.46;
    const breath = 0.5 + 0.5 * Math.sin(this.t * 0.9);
    const R = Math.min(w, h) * (0.11 + lvl * 0.14 + breath * 0.015);
    const hue = (c) => `hsla(${p.h | 0}, ${p.sat | 0}%, ${(p.light + 6) | 0}%, ${c})`;
    s.globalCompositeOperation = 'lighter';
    const g = s.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, hue(0.42 + lvl * 0.4));
    g.addColorStop(0.35, hue(0.14 + lvl * 0.12));
    g.addColorStop(1, hue(0));
    s.fillStyle = g;
    s.beginPath(); s.arc(cx, cy, R, 0, Math.PI * 2); s.fill();
    // 얇은 광륜(rim) — 살짝 회전하는 가는 링으로 정밀감
    const rimR = R * 1.18;
    s.strokeStyle = hue(0.10 + lvl * 0.18);
    s.lineWidth = 1.4;
    s.beginPath(); s.arc(cx, cy, rimR, 0, Math.PI * 2); s.stroke();
    s.globalCompositeOperation = 'source-over';
  }
}
