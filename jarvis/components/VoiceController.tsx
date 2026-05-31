// components/VoiceController.tsx
"use client";
import { useJarvis } from "@/hooks/useJarvis";
import { useJarvisStore } from "@/lib/store";
import { useEffect, useState } from "react";

const LABEL: Record<string, string> = {
  idle: "대기", listening: "듣는 중", thinking: "사고 중", speaking: "답변 중",
};

export function VoiceController() {
  const { enable } = useJarvis();
  const mode = useJarvisStore((s) => s.mode);
  const transcript = useJarvisStore((s) => s.transcript);
  const response = useJarvisStore((s) => s.response);
  const notice = useJarvisStore((s) => s.notice);
  const supported = useJarvisStore((s) => s.supported);
  const [started, setStarted] = useState(false);

  // dev: Playwright가 상태를 강제로 바꿀 수 있게 노출 (Task 6.1)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as any).__jarvis = { setMode: useJarvisStore.getState().setMode };
      return () => { delete (window as any).__jarvis; };
    }
  }, []);

  if (!supported) {
    return <Overlay><p>이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Edge로 열어주세요.</p></Overlay>;
  }

  return (
    <>
      {!started && (
        <Overlay>
          <button
            onClick={() => { setStarted(true); enable(); }}
            style={{ padding: "16px 32px", fontSize: 18, borderRadius: 16, cursor: "pointer",
              background: "linear-gradient(135deg, #5ef2ff, #a98bff)", color: "#06060a", border: "none",
              fontWeight: 600, boxShadow: "0 0 40px rgba(94,242,255,.5)" }}
          >🎙️ 음성으로 대화 시작</button>
        </Overlay>
      )}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 28, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: 12, letterSpacing: ".15em", color: "#5ef2ff", textTransform: "uppercase",
          fontFamily: "var(--font-mono)" }}>
          {LABEL[mode]}{notice ? ` · ${notice}` : ""}
        </div>
        {transcript && <div style={{ marginTop: 8, color: "#9a9ac0", fontSize: 14 }}>나: {transcript}</div>}
        {response && <div style={{ marginTop: 4, color: "#eef0ff", fontSize: 16, maxWidth: 720, margin: "4px auto 0" }}>{response}</div>}
      </div>
    </>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 10, textAlign: "center", padding: 24 }}>
      {children}
    </div>
  );
}
