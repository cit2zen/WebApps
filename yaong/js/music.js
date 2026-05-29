// 에셋 없이 Web Audio로 합성하는 경쾌한 루프 배경음악.
// 게임 루프가 아닌 오디오 스케줄러이므로 setTimeout 룩어헤드를 사용한다.
const MUTE_KEY = "yaong-jump-music-muted";

// 음이름 → 주파수(Hz)
const N = {
  0: null,
  G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
};

// 8분음표 16스텝 멜로디(밝은 C장조 두 마디, 무한 반복)
const LEAD = [
  "E5","G5","E5","C5", "D5","E5","D5","G4",
  "F5","A5","F5","D5", "E5","G5","C5",0,
];
// 마디마다 베이스 루트(4스텝당 1음)
const BASS = ["C4","A3","D4","G3"];

export class Music {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this._timer = null;
    this.stepDur = 0.21; // 8분음표 길이(초) ≈ 142 BPM
    this._tick = this._tick.bind(this);
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.06;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  start() {
    if (this.muted || this.playing) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    this._ensure();
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this._tick();
  }

  stop() {
    this.playing = false;
    clearTimeout(this._timer);
    this._timer = null;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    if (m) this.stop();
    else this.start();
  }

  // 0.1초 앞을 미리 예약하고 재귀 setTimeout으로 이어간다.
  _tick() {
    if (!this.playing) return;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this._schedule(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % LEAD.length;
    }
    this._timer = setTimeout(this._tick, 30);
  }

  _schedule(step, time) {
    const lead = N[LEAD[step]];
    if (lead) this._note(lead, time, this.stepDur * 0.9, "triangle", 0.5);
    // 마디 시작마다 베이스
    if (step % 4 === 0) {
      const bass = N[BASS[(step / 4) % BASS.length]];
      if (bass) this._note(bass, time, this.stepDur * 3.6, "sine", 0.6);
    }
  }

  _note(freq, time, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }
}
