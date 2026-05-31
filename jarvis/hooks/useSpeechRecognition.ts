"use client";
import { useCallback, useEffect, useRef } from "react";

interface Options {
  lang?: string;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onUnsupported?: () => void;
  onSpeechStart?: () => void;
}

export function useSpeechRecognition({ lang = "ko-KR", onFinal, onInterim, onUnsupported, onSpeechStart }: Options) {
  const recRef = useRef<any>(null);
  const shouldListen = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef({ onFinal, onInterim, onSpeechStart, onUnsupported });
  cb.current = { onFinal, onInterim, onSpeechStart, onUnsupported };

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { cb.current.onUnsupported?.(); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) cb.current.onFinal?.(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) cb.current.onInterim?.(interim);
    };
    rec.onspeechstart = () => cb.current.onSpeechStart?.();
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") shouldListen.current = false;
    };
    rec.onend = () => {
      if (!shouldListen.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try { rec.start(); } catch { /* InvalidStateError 등 무시 */ }
      }, 200);
    };

    recRef.current = rec;
    return () => {
      shouldListen.current = false;
      if (timer.current) clearTimeout(timer.current);
      rec.onend = null; rec.onresult = null; rec.onerror = null;
      try { rec.abort(); } catch {}
    };
  }, [lang]);

  const start = useCallback(() => {
    shouldListen.current = true;
    try { recRef.current?.start(); } catch {}
  }, []);
  const stop = useCallback(() => {
    shouldListen.current = false;
    try { recRef.current?.stop(); } catch {}
  }, []);

  return { start, stop };
}
