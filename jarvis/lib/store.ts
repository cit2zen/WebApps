// lib/store.ts
import { create } from "zustand";
import { STATE, MODE_NUM, type Mode } from "./audioBus";

interface JarvisState {
  mode: Mode;
  transcript: string; // 마지막 사용자 발화(자막)
  response: string;   // 현재 AI 응답 누적
  notice: string;     // 도구/서브에이전트 알림
  supported: boolean; // 브라우저 STT 지원 여부
  setMode: (m: Mode) => void;
  setTranscript: (t: string) => void;
  appendResponse: (t: string) => void;
  resetResponse: () => void;
  setNotice: (n: string) => void;
  setSupported: (s: boolean) => void;
  reset: () => void;
}

export const useJarvisStore = create<JarvisState>((set) => ({
  mode: "idle",
  transcript: "",
  response: "",
  notice: "",
  supported: true,
  setMode: (mode) => { STATE.current = MODE_NUM[mode]; set({ mode }); },
  setTranscript: (transcript) => set({ transcript }),
  appendResponse: (t) => set((s) => ({ response: s.response + t })),
  resetResponse: () => set({ response: "" }),
  setNotice: (notice) => set({ notice }),
  setSupported: (supported) => set({ supported }),
  reset: () => { STATE.current = 0; set({ mode: "idle", transcript: "", response: "", notice: "" }); },
}));
