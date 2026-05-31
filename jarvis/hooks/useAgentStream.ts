"use client";
import { useCallback, useRef } from "react";
import { createSseParser } from "@/lib/sse";
import type { AgentEvent } from "@/lib/events";

export function useAgentStream(onEvent: (e: AgentEvent) => void) {
  const sessionId = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const send = useCallback(async (message: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const parse = createSseParser();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: sessionId.current }),
        signal: ac.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const ev of parse(decoder.decode(value, { stream: true }))) {
          if (ev.type === "done" && ev.sessionId) sessionId.current = ev.sessionId;
          onEventRef.current(ev);
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") onEventRef.current({ type: "error", message: String(e) });
    }
  }, []);

  const abort = useCallback(() => abortRef.current?.abort(), []);
  return { send, abort };
}
