// 마이크 입력을 실시간 음량(0~1)으로 변환한다.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.ready = false;
    this.error = null;
    this._level = 0;        // 평활화된 음량
    this._mock = null;      // 테스트용 강제 음량 (null이면 실제 마이크 사용)
  }

  // 마이크 권한 요청 + 분석기 구성. 성공 true, 실패 false.
  async init() {
    if (this.ready) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.data = new Uint8Array(this.analyser.fftSize);
      source.connect(this.analyser);
      this.ready = true;
      this.error = null;
      return true;
    } catch (err) {
      this.error = err && err.name ? err.name : "마이크 오류";
      this.ready = false;
      return false;
    }
  }

  // 일부 브라우저는 사용자 제스처 이후에 resume 필요.
  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  // 현재 음량(0~1). 테스트용 mock이 설정되어 있으면 그 값을 돌려준다.
  getLevel() {
    if (this._mock !== null) return this._mock;
    if (!this.ready) return 0;

    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128; // -1 ~ 1
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.data.length); // 0 ~ 1 (실제론 작음)
    const scaled = Math.min(1, rms * 3.2);         // 사람 목소리 대역 보정

    // 빠르게 차오르고 천천히 떨어지도록 비대칭 평활화
    if (scaled > this._level) this._level += (scaled - this._level) * 0.7;
    else this._level += (scaled - this._level) * 0.25;
    return this._level;
  }

  // 테스트 훅: 음량을 강제 주입(0~1) 또는 해제(null).
  setMockLevel(v) {
    this._mock = v;
  }
}
