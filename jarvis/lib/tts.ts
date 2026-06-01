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
