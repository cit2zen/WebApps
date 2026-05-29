// WebAudio 기반 효과음 + 합성 배경음(BGM). 외부 파일 없음.
// BGM은 게임 루프(rAF)에서 update()로 룩어헤드 스케줄링한다.
const BGM_KEY = "neon-pacman-bgm";
const SFX_KEY = "neon-pacman-sfx";

// 16스텝 루프 (간단한 칩튠). 0 = 쉼표.
const MELODY = [659, 0, 784, 659, 587, 0, 523, 587, 659, 0, 784, 880, 784, 0, 659, 0];
const BASS   = [131, 0, 131, 0, 165, 0, 165, 0, 196, 0, 196, 0, 165, 0, 147, 0];
const STEP_DUR = 0.145;

export class Audio {
  constructor() {
    this.ctx = null;
    this.bgmVol = clamp01(parseFloat(localStorage.getItem(BGM_KEY) ?? "0.35"));
    this.sfxVol = clamp01(parseFloat(localStorage.getItem(SFX_KEY) ?? "0.6"));
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgmOn = false;
    this._nextTime = 0;
    this._step = 0;
    this._chompHi = false;
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmVol;
      this.sfxGain.gain.value = this.sfxVol;
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setBgmVol(v) {
    this.bgmVol = clamp01(v);
    localStorage.setItem(BGM_KEY, String(this.bgmVol));
    if (this.bgmGain) this.bgmGain.gain.value = this.bgmVol;
  }

  setSfxVol(v) {
    this.sfxVol = clamp01(v);
    localStorage.setItem(SFX_KEY, String(this.sfxVol));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
  }

  // ---- 효과음 ----
  _note(dest, freq, dur, type, gain, at) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur);
  }

  chomp() {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    const f0 = this._chompHi ? 440 : 340;
    const f1 = this._chompHi ? 300 : 230;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.085);
    // 부드러운 어택/릴리즈로 클릭음 제거
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
    this._chompHi = !this._chompHi;
  }

  power() { this._note(this.sfxGain, 120, 0.4, "sawtooth", 0.6); }

  eatGhost() {
    const ctx = this._ensure();
    if (!ctx) return;
    this._note(this.sfxGain, 500, 0.08, "square", 0.7);
    this._note(this.sfxGain, 800, 0.12, "square", 0.7, ctx.currentTime + 0.08);
  }

  death() {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.7);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  win() {
    const ctx = this._ensure();
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      this._note(this.sfxGain, f, 0.18, "triangle", 0.7, ctx.currentTime + i * 0.12));
  }

  // ---- BGM ----
  startBgm() {
    const ctx = this._ensure();
    if (!ctx) return;
    if (!this.bgmOn) {
      this.bgmOn = true;
      this._nextTime = ctx.currentTime + 0.05;
    }
  }

  stopBgm() { this.bgmOn = false; }

  update() {
    if (!this.ctx || !this.bgmOn) return;
    const lookahead = 0.25;
    while (this._nextTime < this.ctx.currentTime + lookahead) {
      const i = this._step % MELODY.length;
      if (MELODY[i]) this._note(this.bgmGain, MELODY[i], STEP_DUR * 0.9, "square", 0.22, this._nextTime);
      if (BASS[i]) this._note(this.bgmGain, BASS[i], STEP_DUR * 1.4, "triangle", 0.3, this._nextTime);
      this._nextTime += STEP_DUR;
      this._step++;
    }
  }
}

function clamp01(v) {
  if (Number.isNaN(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}
