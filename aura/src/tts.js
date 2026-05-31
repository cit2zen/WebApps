// SpeechSynthesis 음독 + 합성 엔벨로프. getEnvelope()로 매 프레임 level/spectrum 근사 제공.
export class TTS {
  constructor() {
    this.speaking = false;
    this._target = 0;   // boundary마다 펄스
    this._level = 0;
    this._t = 0;
    this._spectrum = new Uint8Array(96);
    this._voice = null;
    this._pickVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
  }

  _pickVoice() {
    const voices = speechSynthesis.getVoices();
    this._voice = voices.find((v) => v.lang && v.lang.startsWith('ko')) || voices[0] || null;
  }

  speak(text) {
    return new Promise((resolve) => {
      if (!text) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (this._voice) u.voice = this._voice;
      u.rate = 1.0; u.pitch = 1.05;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        this.speaking = false;
        this._target = 0;
        resolve();
      };
      u.addEventListener('start', () => { this.speaking = true; });
      u.addEventListener('boundary', () => { this._target = 0.85 + Math.random() * 0.15; });
      u.addEventListener('end', finish);
      u.addEventListener('error', finish);
      speechSynthesis.cancel();
      // 낙관적으로 발화 상태 진입 → start 이벤트가 늦거나 누락돼도 비주얼 엔벨로프 보장.
      this.speaking = true;
      this._target = 0.6;
      speechSynthesis.speak(u);
      if (speechSynthesis.paused) speechSynthesis.resume();
      // end 이벤트가 끝내 안 오는 브라우저 대비 안전 타이머.
      const watchdog = setTimeout(finish, 1500 + text.length * 130);
    });
  }

  cancel() { speechSynthesis.cancel(); this.speaking = false; this._target = 0; }

  // 매 프레임 호출 권장(렌더 루프). dt 기반 엔벨로프 감쇠.
  update(dt) {
    this._t += dt;
    // boundary 펄스로 솟구치고 서서히 감쇠 + 트레모어
    this._target *= Math.max(0, 1 - dt * 3.5);
    const tremor = this.speaking ? 0.12 * (0.5 + 0.5 * Math.sin(this._t * 22)) : 0;
    const goal = this.speaking ? Math.max(0.25, this._target) + tremor : 0;
    this._level += (goal - this._level) * Math.min(1, dt * 12);
    // 가짜 스펙트럼: level 따라 출렁이는 막대들
    for (let i = 0; i < this._spectrum.length; i++) {
      const v = this._level * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.5 + this._t * 9 + i)));
      this._spectrum[i] = Math.min(255, v * 255);
    }
  }

  getEnvelope() { return { level: this._level, spectrum: this._spectrum }; }
}
