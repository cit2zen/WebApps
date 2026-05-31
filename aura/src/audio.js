// 마이크 입력을 Web Audio AnalyserNode로 분석. level(0..1)과 주파수 스펙트럼 제공.
export class MicAudio {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.stream = null;
    this.src = null;
    this._level = 0;
  }

  async start() {
    if (this.analyser) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // AudioContext는 한 번만 만들고 재사용한다(시작/정지 반복 시 개수 제한 회피).
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.78;
    this.src.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
  }

  stop() {
    this.src?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.analyser = this.freq = this.stream = this.src = null;
    this._level = 0;
    // this.ctx는 닫지 않고 보존 → 다음 start()에서 재사용.
  }

  // 매 프레임 호출. 최신 스펙트럼/level 갱신.
  sample() {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.freq);
    let sum = 0;
    for (let i = 0; i < this.freq.length; i++) sum += this.freq[i] * this.freq[i];
    const rms = Math.sqrt(sum / this.freq.length) / 255;
    // 부드럽게 추종 + 살짝 부스트
    this._level += (Math.min(1, rms * 1.6) - this._level) * 0.35;
  }

  getLevel() { return this._level; }
  getSpectrum() { return this.freq; } // Uint8Array 또는 null
}
