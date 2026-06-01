// 고품질 신경망 TTS 재생 + 실제 오디오 엔벨로프(AnalyserNode).
// 1순위: 서버 /api/tts(Edge Neural, mp3) → WebAudio 재생 + 실시간 스펙트럼.
// 폴백: 브라우저 speechSynthesis(서버 합성 실패 시). getEnvelope()로 비주얼라이저에 level/spectrum 공급.
import { cleanForSpeech } from './clean.js';

export class TTS {
  constructor() {
    this.speaking = false;
    this._ac = null;
    this._analyser = null;
    this._freq = null;
    this._time = null;
    this._src = null; // 현재 AudioBufferSourceNode
    this._level = 0;
    this._spectrum = new Uint8Array(96);
    this._usingAnalyser = false;
    // 폴백(speechSynthesis)용 가짜 엔벨로프 상태
    this._target = 0;
    this._t = 0;
    this._voice = null;
    this._pickVoice();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
  }

  _ensureAC() {
    if (!this._ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this._ac = new AC();
      this._analyser = this._ac.createAnalyser();
      this._analyser.fftSize = 256;
      this._analyser.smoothingTimeConstant = 0.8;
      this._analyser.connect(this._ac.destination);
      this._freq = new Uint8Array(this._analyser.frequencyBinCount);
      this._time = new Uint8Array(this._analyser.frequencyBinCount);
    }
    if (this._ac.state === 'suspended') this._ac.resume();
    return this._ac;
  }

  async speak(rawText) {
    const text = cleanForSpeech(rawText); // 마크다운/이모지 제거 후 발화
    if (!text) return;
    this.cancel();
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('tts ' + res.status);
      const buf = await res.arrayBuffer();
      const ac = this._ensureAC();
      const audioBuf = await ac.decodeAudioData(buf);
      await this._playBuffer(ac, audioBuf);
    } catch {
      await this._speakFallback(text); // 네트워크/디코드 실패 → 로봇음이라도 보장
    }
  }

  _playBuffer(ac, audioBuf) {
    return new Promise((resolve) => {
      const src = ac.createBufferSource();
      src.buffer = audioBuf;
      src.connect(this._analyser);
      this._src = src;
      this._usingAnalyser = true;
      this.speaking = true;
      src.onended = () => {
        if (this._src === src) {
          this._src = null;
          this._usingAnalyser = false;
          this.speaking = false;
        }
        resolve();
      };
      src.start();
    });
  }

  _speakFallback(text) {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === 'undefined') return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (this._voice) u.voice = this._voice;
      u.rate = 1.0;
      u.pitch = 1.05;
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
      this.speaking = true;
      this._target = 0.6;
      speechSynthesis.speak(u);
      if (speechSynthesis.paused) speechSynthesis.resume();
      const watchdog = setTimeout(finish, 1500 + text.length * 130);
    });
  }

  _pickVoice() {
    if (typeof speechSynthesis === 'undefined') return;
    const voices = speechSynthesis.getVoices();
    this._voice = voices.find((v) => v.lang && v.lang.startsWith('ko')) || voices[0] || null;
  }

  cancel() {
    if (this._src) {
      try { this._src.onended = null; this._src.stop(); } catch { /* already stopped */ }
      this._src = null;
    }
    this._usingAnalyser = false;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.speaking = false;
    this._target = 0;
  }

  // 매 프레임 호출(렌더 루프). 재생 중이면 실측 엔벨로프, 아니면 감쇠.
  update(dt) {
    this._t += dt;
    if (this._usingAnalyser && this._analyser) {
      this._analyser.getByteFrequencyData(this._freq);
      this._analyser.getByteTimeDomainData(this._time);
      let sum = 0;
      for (let i = 0; i < this._time.length; i++) {
        const v = (this._time[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this._time.length);
      const goal = Math.min(1, rms * 3.2);
      this._level += (goal - this._level) * Math.min(1, dt * 16);
      const n = this._freq.length;
      for (let i = 0; i < 96; i++) {
        this._spectrum[i] = this._freq[Math.floor((i / 96) * n)];
      }
      return;
    }
    // 폴백 가짜 엔벨로프(speechSynthesis 경로)
    this._target *= Math.max(0, 1 - dt * 3.5);
    const tremor = this.speaking ? 0.12 * (0.5 + 0.5 * Math.sin(this._t * 22)) : 0;
    const goal = this.speaking ? Math.max(0.25, this._target) + tremor : 0;
    this._level += (goal - this._level) * Math.min(1, dt * 12);
    for (let i = 0; i < this._spectrum.length; i++) {
      const v = this._level * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.5 + this._t * 9 + i)));
      this._spectrum[i] = Math.min(255, v * 255);
    }
  }

  getEnvelope() { return { level: this._level, spectrum: this._spectrum }; }
}
