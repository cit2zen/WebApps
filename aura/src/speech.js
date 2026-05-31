// Web Speech SpeechRecognition 래퍼(한국어, 단발 인식).
export class Speech {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    this.rec = this.supported ? new SR() : null;
    if (this.rec) {
      this.rec.lang = 'ko-KR';
      this.rec.interimResults = true;
      this.rec.continuous = false;
      this.rec.maxAlternatives = 1;
    }
    this.onInterim = () => {};
    this.onFinal = () => {};
    this.onEnd = () => {};
    this.onError = () => {};
    this._final = '';
    if (this.rec) this._wire();
  }

  _wire() {
    this.rec.addEventListener('result', (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this._final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.onInterim(interim);
    });
    this.rec.addEventListener('end', () => {
      const text = this._final.trim();
      this._final = '';
      this.onEnd(text);
    });
    this.rec.addEventListener('error', (e) => this.onError(e.error));
  }

  start() {
    if (!this.rec) return;
    this._final = '';
    try { this.rec.start(); } catch (_) {}
  }
  stop() { this.rec?.stop(); }
}
