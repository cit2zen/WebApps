// hooks/useJarvis.ts
"use client";
import { useCallback, useEffect, useRef } from "react";
import { useMicAnalyser } from "./useMicAnalyser";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAgentStream } from "./useAgentStream";
import { BrowserTTS } from "@/lib/tts";
import { makeBargeInDetector } from "@/lib/bargeIn";
import { createSentenceBuffer } from "@/lib/sentenceBuffer";
import { useJarvisStore } from "@/lib/store";
import { audio } from "@/lib/audioBus";
import type { AgentEvent } from "@/lib/events";

export function useJarvis() {
  const store = useJarvisStore;
  const ttsRef = useRef<BrowserTTS | null>(null);
  const sentence = useRef(createSentenceBuffer());
  const startedRef = useRef(false);
  const streaming = useRef(false); // 서버 스트림이 진행 중인지(턴 종료 게이트)

  // 시각 진폭 muxing: listening=마이크RMS, speaking=감쇠 엔벌로프, else 0
  const mic = useMicAnalyser((rms, now) => {
    const mode = store.getState().mode;
    if (mode === "listening") audio.amplitude = rms;
    else if (mode === "speaking") {
      audio.speakingEnv = Math.max(0, audio.speakingEnv - 0.04);
      audio.amplitude = audio.speakingEnv;
    } else {
      audio.amplitude = Math.max(0, audio.amplitude - 0.03);
    }
    bargeTick.current(rms, ttsRef.current?.speaking ?? false, now);
  });

  const bargeTick = useRef(makeBargeInDetector({}));

  const { send, abort } = useAgentStream((e: AgentEvent) => onEvent(e));

  // 스트림이 끝났고 TTS도 다 말했을 때만 듣기로 복귀(문장 사이 큐 빔으로 조기 종료 방지)
  const maybeFinish = useCallback(() => {
    if (streaming.current) return;
    if (ttsRef.current?.speaking) return;
    const m = store.getState().mode;
    if (m === "speaking" || m === "thinking") store.getState().setMode("listening");
  }, [store]);

  const onEvent = useCallback((e: AgentEvent) => {
    const s = store.getState();
    switch (e.type) {
      case "state":
        s.setMode(e.state);
        if (e.state === "speaking") audio.speakingEnv = 0.6; // 즉시 시각 반응
        break;
      case "text":
        s.appendResponse(e.delta);
        for (const sent of sentence.current.feed(e.delta)) ttsRef.current?.enqueue(sent);
        break;
      case "tool":
        s.setNotice(`도구: ${e.name}`);
        break;
      case "subagent":
        s.setNotice(`에이전트 팀: ${e.name}`);
        break;
      case "done": {
        const rest = sentence.current.flush();
        if (rest) ttsRef.current?.enqueue(rest);
        streaming.current = false;
        maybeFinish();
        break;
      }
      case "error":
        streaming.current = false;
        s.setNotice("문제가 발생했어요.");
        s.setMode("listening");
        break;
    }
  }, [store, maybeFinish]);

  const { start: startStt, stop: stopStt } = useSpeechRecognition({
    lang: "ko-KR",
    onUnsupported: () => store.getState().setSupported(false),
    onFinal: (text) => {
      if (!text) return;
      const s = store.getState();
      if (s.mode !== "listening") return; // 듣는 중일 때만 새 턴 시작(자기 답변 가로채기 방지)
      s.setTranscript(text);
      s.resetResponse();
      sentence.current = createSentenceBuffer();
      streaming.current = true;
      s.setMode("thinking");
      send(text);
    },
  });

  // barge-in 콜백 결선: 말하는 도중 사용자가 끼어들면 TTS·서버 중단
  useEffect(() => {
    bargeTick.current = makeBargeInDetector({
      onBargeIn: () => {
        ttsRef.current?.cancel();
        abort();
        streaming.current = false;
        store.getState().setMode("listening");
      },
    });
  }, [abort, store]);

  // 첫 사용자 제스처에서 호출 (오디오/마이크/TTS 시작 + 인사)
  const enable = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const s = store.getState();
    const tts = new BrowserTTS();
    await tts.init();
    tts.onWord = () => { audio.speakingEnv = 0.85; }; // 단어마다 엔벌로프 튐
    tts.onIdle = () => maybeFinish();
    ttsRef.current = tts;
    try {
      await mic.start(); // 마이크 권한 거부/장치 없음 → reject → 아래 catch
    } catch {
      startedRef.current = false;
      s.setNotice("마이크 권한이 필요해요. 허용 후 다시 시작해주세요.");
      return;
    }
    startStt();
    s.setMode("speaking");
    tts.enqueue("안녕하세요. JARVIS입니다. 무엇을 도와드릴까요?");
  }, [mic, startStt, store, maybeFinish]);

  useEffect(() => () => { stopStt(); ttsRef.current?.cancel(); }, [stopStt]);

  return { enable };
}
