"use client";
import { chunkText } from "./ttsChunker";
import { cleanForSpeech } from "./cleanText";

export interface WordInfo { word: string; globalCharIndex: number; }

export interface TextToSpeech {
  init(): Promise<void>;
  enqueue(text: string): void;   // 문장을 큐에 추가(현재 재생 유지)
  cancel(): void;                // 큐 비우고 즉시 정지 (barge-in)
  readonly speaking: boolean;
  onWord?: (w: WordInfo) => void;
  onIdle?: () => void;           // 큐가 비고 재생 끝남
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => {
      speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener("voiceschanged", handler);
    let tries = 0;
    const poll = setInterval(() => {
      const v = speechSynthesis.getVoices();
      if (v.length || ++tries > 20) {
        clearInterval(poll);
        speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(v);
      }
    }, 100);
  });
}

export class BrowserTTS implements TextToSpeech {
  private voice: SpeechSynthesisVoice | null = null;
  private queue: string[] = [];
  private playing = false;
  private cancelled = false;
  private globalBase = 0;
  onWord?: (w: WordInfo) => void;
  onIdle?: () => void;

  get speaking() { return this.playing; }

  async init() {
    const voices = await loadVoices();
    this.voice =
      voices.find((v) => v.lang === "ko-KR") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("ko")) ||
      null;
  }

  enqueue(text: string) {
    this.cancelled = false;
    const spoken = cleanForSpeech(text); // 마크다운/이모지 제거 후 발화
    if (!spoken) return;
    for (const c of chunkText(spoken)) this.queue.push(c);
    if (!this.playing) this.playNext();
  }

  cancel() {
    this.cancelled = true;
    this.queue = [];
    this.playing = false;
    speechSynthesis.cancel();
  }

  private playNext() {
    if (this.cancelled) return;
    const chunk = this.queue.shift();
    if (chunk === undefined) {
      this.playing = false;
      this.onIdle?.();
      return;
    }
    this.playing = true;
    const base = this.globalBase;
    const u = new SpeechSynthesisUtterance(chunk);
    if (this.voice) u.voice = this.voice;
    u.lang = "ko-KR";
    u.rate = 1.05;
    u.onboundary = (e) => {
      if (e.name !== "word") return;
      const len = (e as any).charLength || 0;
      const word = len > 0 ? chunk.substr(e.charIndex, len) : chunk.slice(e.charIndex).split(/\s/)[0];
      this.onWord?.({ word, globalCharIndex: base + e.charIndex });
    };
    u.onend = () => {
      this.globalBase += chunk.length;
      this.playNext();
    };
    u.onerror = (e) => {
      // 우리가 cancel()한 경우(interrupted/canceled)는 정상 — 무시
      if (e.error === "interrupted" || e.error === "canceled") return;
      // 진짜 에러: 큐 비우고 idle 통지(소비자가 speaking→listening 전환할 수 있게)
      this.queue = [];
      this.playing = false;
      this.onIdle?.();
    };
    speechSynthesis.speak(u);
  }
}

// 고품질 신경망 TTS — 서버 /api/tts(Edge Neural, mp3)를 문장 단위로 받아 WebAudio로 재생.
// AnalyserNode로 실측 진폭을 제공(오브가 실제 음성에 반응). 실패 시 speechSynthesis 폴백.
export class NeuralTTS implements TextToSpeech {
  private ac: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeBuf: Uint8Array<ArrayBuffer> | null = null;
  private queue: string[] = [];
  private busy = false;
  private cancelled = false;
  private src: AudioBufferSourceNode | null = null;
  private ctrl: AbortController | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  onWord?: (w: WordInfo) => void; // 미사용(분석기로 대체)
  onIdle?: () => void;

  get speaking() { return this.busy || this.queue.length > 0; }

  async init() {
    const voices = await loadVoices();
    this.voice = voices.find((v) => v.lang === "ko-KR") || voices.find((v) => v.lang?.toLowerCase().startsWith("ko")) || null;
  }

  private ensureAC(): AudioContext {
    if (!this.ac) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new AC();
      this.analyser = this.ac.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.connect(this.ac.destination);
      this.timeBuf = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ac.state === "suspended") void this.ac.resume();
    return this.ac;
  }

  enqueue(text: string) {
    const clean = cleanForSpeech(text);
    if (!clean) return;
    this.cancelled = false;
    this.queue.push(clean);
    void this.pump();
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length && !this.cancelled) {
      const text = this.queue.shift()!;
      try {
        const audio = await this.fetchDecode(text);
        if (this.cancelled) break;
        await this.play(audio);
      } catch {
        if (this.cancelled) break;
        await this.fallback(text); // 서버 합성 실패 → 로봇음이라도 보장
      }
    }
    this.busy = false;
    if (!this.cancelled && this.queue.length === 0) this.onIdle?.();
  }

  private async fetchDecode(text: string): Promise<AudioBuffer> {
    this.ctrl = new AbortController();
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: this.ctrl.signal,
    });
    if (!res.ok) throw new Error("tts " + res.status);
    const buf = await res.arrayBuffer();
    return await this.ensureAC().decodeAudioData(buf);
  }

  private play(audio: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const ac = this.ensureAC();
      const src = ac.createBufferSource();
      src.buffer = audio;
      src.connect(this.analyser!);
      this.src = src;
      src.onended = () => { if (this.src === src) this.src = null; resolve(); };
      src.start();
    });
  }

  private fallback(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = "ko-KR";
      u.rate = 1.05;
      let done = false;
      const fin = () => { if (done) return; done = true; resolve(); };
      u.onend = fin;
      u.onerror = fin;
      speechSynthesis.speak(u);
    });
  }

  // 재생 중 실측 진폭(0..1). useJarvis가 speaking 모드에서 오브 진폭으로 사용.
  getLevel(): number {
    if (!this.analyser || !this.timeBuf || !this.src) return 0;
    this.analyser.getByteTimeDomainData(this.timeBuf);
    let sum = 0;
    for (let i = 0; i < this.timeBuf.length; i++) { const v = (this.timeBuf[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / this.timeBuf.length) * 3.2);
  }

  cancel() {
    this.cancelled = true;
    this.queue = [];
    this.ctrl?.abort();
    if (this.src) { try { this.src.onended = null; this.src.stop(); } catch { /* stopped */ } this.src = null; }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.busy = false;
  }
}
