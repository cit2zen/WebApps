// 에셋 없이 Web Audio로 합성하는 아기자기한 효과음.
const MUTE_KEY = "yaong-jump-muted";

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  }

  // 단일 톤: 주파수 스윕 + 짧은 엔벨로프.
  _tone(f0, f1, dur, type = "triangle", vol = 0.18, delay = 0) {
    if (this.muted) return;
    const ctx = this._ensure();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  jump() {
    // 만화풍 "뿅" 보잉: 빠르게 솟구쳤다 살짝 내려오는 꼬리음
    this._tone(300, 900, 0.13, "triangle", 0.28);
    this._tone(900, 680, 0.12, "triangle", 0.16, 0.10);
  }

  point() {
    // 동전 같은 두 음
    this._tone(880, 880, 0.08, "square", 0.12);
    this._tone(1320, 1320, 0.12, "square", 0.12, 0.08);
  }

  hit() {
    // 부딪힘 "삐긱"
    this._tone(300, 90, 0.22, "sawtooth", 0.2);
  }

  gameover() {
    // 풀죽은 내림 아르페지오
    this._tone(660, 660, 0.14, "triangle", 0.18, 0);
    this._tone(520, 520, 0.14, "triangle", 0.18, 0.14);
    this._tone(390, 330, 0.3, "triangle", 0.18, 0.28);
  }

  click() {
    this._tone(520, 720, 0.07, "square", 0.1);
  }
}
