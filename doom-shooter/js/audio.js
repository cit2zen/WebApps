// Procedural WebAudio engine — no asset files. SFX synthesized on the fly,
// BGM rendered once into a looping buffer.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this._musicSrc = null;
    const s = JSON.parse(localStorage.getItem('doom-audio') || '{}');
    this.vol = {
      master: s.master ?? 0.8,
      sfx: s.sfx ?? 0.9,
      music: s.music ?? 0.45,
    };
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this._noise = this._makeNoise(1);
    this._music = this._buildMusic();
    this._apply();
    this.ready = true;
  }

  _apply() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfxGain.gain.value = this.vol.sfx;
    this.musicGain.gain.value = this.vol.music * 0.6;
  }
  _save() { localStorage.setItem('doom-audio', JSON.stringify(this.vol)); }
  setMaster(v) { this.vol.master = v; this._save(); this._apply(); }
  setSfx(v) { this.vol.sfx = v; this._save(); this._apply(); this.tick(); }
  setMusic(v) { this.vol.music = v; this._save(); this._apply(); }

  _makeNoise(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noiseBurst(dur, freq, peak) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(g).connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone(type, f0, f1, dur, peak, when = 0) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shot() { if (!this.ready) return; this._noiseBurst(0.13, 1900, 0.9); this._tone('square', 170, 48, 0.12, 0.5); }
  hit() { if (!this.ready) return; this._tone('square', 900, 400, 0.07, 0.35); }
  enemyDeath() { if (!this.ready) return; this._tone('sawtooth', 420, 60, 0.45, 0.4); this._noiseBurst(0.4, 800, 0.35); }
  hurt() { if (!this.ready) return; this._tone('sine', 220, 70, 0.3, 0.5); this._noiseBurst(0.18, 500, 0.3); }
  empty() { if (!this.ready) return; this._tone('square', 1200, 1100, 0.03, 0.18); }
  reload() { if (!this.ready) return; this._noiseBurst(0.05, 2500, 0.4); this._tone('square', 300, 240, 0.05, 0.25); setTimeout(() => this._noiseBurst(0.05, 2200, 0.4), 280); }
  tick() { if (!this.ready) return; this._tone('square', 800, 800, 0.02, 0.15); }
  clear() { if (!this.ready) return; [392, 523, 659].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.3, i * 0.12)); }
  win() { if (!this.ready) return; [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.32, i * 0.16)); }
  dead() { if (!this.ready) return; this._tone('sawtooth', 200, 40, 0.9, 0.45); }

  // Dark looping bassline + kick + hat baked into one buffer.
  _buildMusic() {
    const sr = this.ctx.sampleRate;
    const step = 0.22, steps = 16;
    const len = Math.floor(step * steps * sr);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const bass = [55, 55, 0, 55, 49, 0, 49, 55, 41, 41, 0, 41, 36, 0, 43, 0]; // Hz, 0 = rest
    for (let s = 0; s < steps; s++) {
      const f = bass[s];
      const start = Math.floor(s * step * sr);
      const n = Math.floor(step * sr);
      for (let i = 0; i < n; i++) {
        const tt = i / sr;
        const env = Math.exp(-tt * 6);
        let v = 0;
        if (f > 0) {
          v += (((tt * f) % 1) * 2 - 1) * 0.16 * env;
          v += Math.sin(2 * Math.PI * f * 2 * tt) * 0.05 * env;
        }
        if (s % 4 === 0) {
          const kf = 120 * Math.exp(-tt * 30) + 45;
          v += Math.sin(2 * Math.PI * kf * tt) * 0.55 * Math.exp(-tt * 9);
        }
        if (s % 2 === 1) v += (Math.random() * 2 - 1) * 0.07 * Math.exp(-tt * 45);
        d[start + i] += v * 0.9;
      }
    }
    return buf;
  }

  startMusic() {
    if (!this.ready || this._musicSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._music;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this._musicSrc = src;
  }
  stopMusic() {
    if (this._musicSrc) { try { this._musicSrc.stop(); } catch (e) {} this._musicSrc = null; }
  }

  // --- weapon-specific shot sounds ---
  shotFor(type) {
    if (!this.ready) return;
    if (type === 'shotgun') {
      // lower boomier noise burst + deep pitch drop
      this._noiseBurst(0.22, 900, 1.1);
      this._tone('sawtooth', 110, 28, 0.22, 0.6);
    } else if (type === 'mg') {
      // tighter higher snap
      this._noiseBurst(0.07, 3200, 0.65);
      this._tone('square', 320, 90, 0.07, 0.35);
    } else {
      // pistol = current shot
      this.shot();
    }
  }

  // --- enemy audio cues ---
  casterCast() {
    if (!this.ready) return;
    this._tone('sine', 660, 1320, 0.18, 0.3);
    this._tone('sine', 880, 440, 0.18, 0.2, 0.04);
  }

  roar() {
    if (!this.ready) return;
    this._noiseBurst(0.35, 600, 0.55);
    this._tone('sawtooth', 80, 40, 0.4, 0.5);
    this._tone('sawtooth', 120, 55, 0.35, 0.3, 0.05);
  }

  // --- player feedback ---
  footstep() {
    if (!this.ready) return;
    this._noiseBurst(0.06, 400, 0.22);
    this._tone('sine', 90, 60, 0.06, 0.18);
  }

  pickup() {
    if (!this.ready) return;
    [523, 784, 1047].forEach((f, i) => this._tone('sine', f, f, 0.1, 0.25, i * 0.07));
  }

  weaponSwitch() {
    if (!this.ready) return;
    this._noiseBurst(0.04, 2800, 0.28);
    this._tone('square', 420, 360, 0.05, 0.2);
  }

  // --- ambient drone per theme ---
  ambient(kind) {
    if (!this.ready) return;
    this.stopAmbient();
    // ensure dedicated ambientGain exists
    if (!this._ambientGain) {
      this._ambientGain = this.ctx.createGain();
      this._ambientGain.gain.value = 0.18;
      this._ambientGain.connect(this.musicGain);
    }
    const sr = this.ctx.sampleRate;
    // build a short looping drone buffer tailored to theme
    const dur = 4.0;
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let baseFreq, harmonics, noiseAmt;
    if (kind === 'hell') {
      baseFreq = 36; harmonics = [1, 2, 3, 5]; noiseAmt = 0.08;
    } else if (kind === 'tech') {
      baseFreq = 55; harmonics = [1, 2, 4, 6]; noiseAmt = 0.03;
    } else {
      // stone
      baseFreq = 44; harmonics = [1, 1.5, 2, 3]; noiseAmt = 0.05;
    }
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let v = 0;
      harmonics.forEach((h, idx) => {
        v += Math.sin(2 * Math.PI * baseFreq * h * t) * (0.12 / (idx + 1));
      });
      v += (Math.random() * 2 - 1) * noiseAmt;
      d[i] = v;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this._ambientGain);
    src.start();
    this._ambientSrc = src;
  }

  stopAmbient() {
    if (this._ambientSrc) {
      try { this._ambientSrc.stop(); } catch (e) {}
      this._ambientSrc = null;
    }
  }
}
