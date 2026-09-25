import { drawSpectrum } from './viz/spectrum.js';
import { drawFluid } from './viz/fluid.js';
import { Particles } from './viz/particles.js';
import { Bloom } from './viz/bloom.js';
import { token, mix, rgba } from './viz/color.js';

// 상태=감정. 색은 전부 디자인 토큰(style.css의 --aura-* / 키트 팔레트)에서 읽는다.
// a=강조(페이즈), b=보조, tint=종이 배경에 스미는 강조색 비율, glow/blur=번짐(워시), fade=잔상.
const PHASES = {
  idle:      { a: '--aura-idle',   b: '--ink-light', tint: 0.035, glow: 0.30, blur: 16, fade: 0.13 },
  listening: { a: '--aura-listen', b: '--gold-mid',  tint: 0.05,  glow: 0.34, blur: 14, fade: 0.15 },
  thinking:  { a: '--aura-think',  b: '--ink-mid',   tint: 0.05,  glow: 0.32, blur: 18, fade: 0.13 },
  speaking:  { a: '--aura-speak',  b: '--gold-dark', tint: 0.05,  glow: 0.36, blur: 15, fade: 0.14 },
};

function resolvePalettes() {
  const paper = token('--paper');
  const edge = token('--cream-300');
  const ink = token('--ink-brown');
  const out = {};
  for (const [k, p] of Object.entries(PHASES)) {
    const a = token(p.a);
    out[k] = {
      a, b: token(p.b), ink,
      bg0: mix(paper, a, p.tint), bg1: mix(edge, a, p.tint * 0.8),
      glow: p.glow, blur: p.blur, fade: p.fade,
    };
  }
  return out;
}

function clonePalette(p) {
  return { ...p, a: [...p.a], b: [...p.b], ink: [...p.ink], bg0: [...p.bg0], bg1: [...p.bg1] };
}

export class Visualizer {
  constructor(ctx) {
    this.ctx = ctx;
    this.bloom = new Bloom(0.5);
    this.particles = new Particles();
    this.phase = 'idle';
    this.palettes = resolvePalettes();
    this.cur = clonePalette(this.palettes.idle);
    this.t = 0;
    this.source = () => ({ level: 0, spectrum: null });
    // 웹폰트·스타일 로드 이후 토큰 재확인(캐시된 CSS가 늦게 적용되는 경우 대비)
    if (document.readyState !== 'complete') {
      addEventListener('load', () => { this.palettes = resolvePalettes(); }, { once: true });
    }
  }

  setPhase(p) { this.phase = p; }
  setSource(fn) { this.source = fn; }
  resize(w, h) { this.bloom.resize(w, h); }

  _lerp(dt) {
    const tgt = this.palettes[this.phase] || this.palettes.idle;
    const k = Math.min(1, dt * 2.2);
    for (const key of ['glow', 'blur', 'fade']) {
      this.cur[key] += (tgt[key] - this.cur[key]) * k;
    }
    for (const key of ['a', 'b', 'ink', 'bg0', 'bg1']) {
      for (let i = 0; i < 3; i++) this.cur[key][i] += (tgt[key][i] - this.cur[key][i]) * k;
    }
  }

  // 인화지 배경 — 중앙은 밝은 종이, 가장자리는 크림. 페이즈 강조색이 아주 살짝 스민다.
  _background(w, h) {
    const ctx = this.ctx;
    const p = this.cur;
    const cx = w * (0.5 + 0.06 * Math.sin(this.t * 0.13));
    const cy = h * (0.46 + 0.05 * Math.cos(this.t * 0.11));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
    g.addColorStop(0, rgba(p.bg0, 1));
    g.addColorStop(1, rgba(p.bg1, 1));
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

    // 정적 1프레임(모션 민감 모드, dt 큼)은 잔상 없이 목표 농도로 바로 그린다.
    const fade = this.bloom.begin(dt >= 0.5 ? 1 : this.cur.fade);
    // trail 레이어에서 거의 같은 자리에 겹쳐 그리는 선(멤브레인 링)이 잔상 누적으로
    // 진해지지 않도록 목표 농도 S → 프레임당 알파로 환산(정상 상태에서 S에 수렴).
    const op = (S) => {
      const s = Math.min(0.95, Math.max(0, S));
      return (s * fade) / (1 - s * (1 - fade));
    };

    const layers = { wash: this.bloom.wash, trail: this.bloom.trail };
    const frame = { level, spectrum, palette: this.cur, t: this.t, dt, w, h, op };
    drawFluid(layers.wash, w, h, frame);
    drawSpectrum(layers, w, h, frame);
    this.particles.draw(layers, w, h, frame);
    this._core(layers.wash, w, h, frame);

    this.bloom.composite(this.ctx, this.cur.blur, this.cur.glow);
  }

  // 중앙 코어 — 음성 진폭으로 맥동하는 안료 웅덩이(일반 합성). 얇은 림으로 정밀감.
  _core(s, w, h, frame) {
    const p = frame.palette, lvl = frame.level;
    const cx = w * 0.5, cy = h * 0.46;
    const breath = 0.5 + 0.5 * Math.sin(this.t * 0.9);
    const R = Math.min(w, h) * (0.11 + lvl * 0.14 + breath * 0.015);
    s.globalCompositeOperation = 'source-over';
    const g = s.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, rgba(p.a, 0.16 + lvl * 0.2));
    g.addColorStop(0.35, rgba(p.a, 0.07 + lvl * 0.08));
    g.addColorStop(1, rgba(p.a, 0));
    s.fillStyle = g;
    s.beginPath(); s.arc(cx, cy, R, 0, Math.PI * 2); s.fill();
    // 얇은 림(rim)
    const rimR = R * 1.18;
    s.strokeStyle = rgba(mix(p.a, p.ink, 0.3), 0.2 + lvl * 0.25);
    s.lineWidth = 1.2;
    s.beginPath(); s.arc(cx, cy, rimR, 0, Math.PI * 2); s.stroke();
  }
}
