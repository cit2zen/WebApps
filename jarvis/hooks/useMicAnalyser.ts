"use client";
import { useEffect, useRef } from "react";
import { rmsFromTimeData, bandsFromFreqData } from "@/lib/audioMath";
import { audio } from "@/lib/audioBus";

export interface MicHandle {
  rmsRef: { current: number };
  start: () => Promise<void>;
  stop: () => void;
}

// onFrame(rms, now): barge-in 감지기에 매 프레임 RMS를 전달하는 콜백.
export function useMicAnalyser(onFrame?: (rms: number, now: number) => void): MicHandle {
  const rmsRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const start = async () => {
    if (ctxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser); // destination에 연결하지 않음(피드백 방지)
      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);
        const rms = rmsFromTimeData(timeData);
        rmsRef.current = rms;
        audio.bands = bandsFromFreqData(freqData, 5);
        onFrameRef.current?.(rms, performance.now());
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      // 권한 거부/장치 없음 등 → 부분 상태 정리 후 호출자에 전파
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ctxRef.current = null;
      throw e instanceof Error ? e : new Error(String(e));
    }
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close();
    ctxRef.current = null;
    streamRef.current = null;
  };

  useEffect(() => () => stop(), []);
  return { rmsRef, start, stop };
}
