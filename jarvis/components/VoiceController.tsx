// components/VoiceController.tsx
"use client";
import { useJarvis } from "@/hooks/useJarvis";
import { useJarvisStore } from "@/lib/store";
import { stripMarkdown } from "@/lib/cleanText";
import { useEffect, useRef, useState } from "react";

const LABEL: Record<string, string> = {
  idle: "대기", listening: "듣는 중", thinking: "사고 중", speaking: "답변 중",
};

const EXAMPLES = ["오늘 날씨 알려줘", "비트코인 시세 조사해줘", "지금 몇 시야?"];

export function VoiceController() {
  const { enable, sendText } = useJarvis();
  const mode = useJarvisStore((s) => s.mode);
  const transcript = useJarvisStore((s) => s.transcript);
  const response = useJarvisStore((s) => s.response);
  const notice = useJarvisStore((s) => s.notice);
  const supported = useJarvisStore((s) => s.supported);
  const [started, setStarted] = useState(false);

  // dev: Playwright가 상태를 강제로 바꿀 수 있게 노출 (Task 6.1) — production 빌드에선 제거됨
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as any).__jarvis = { setMode: useJarvisStore.getState().setMode };
      return () => { delete (window as any).__jarvis; };
    }
  }, []);

  const handleStart = async () => {
    setStarted(true);
    const ok = await enable();
    if (!ok) setStarted(false); // 마이크 거부 → 시작 버튼 재노출(재시도 경로)
  };

  // STT 미지원(iOS Safari·Firefox 등): 막다른 안내 대신 텍스트 입력 폴백 제공
  if (!supported) {
    return (
      <>
        <Overlay variant="static">
          <IntroHead>
            이 브라우저는 음성 인식을 지원하지 않아요. 아래에 입력해 대화할 수 있어요.
            (답변은 음성으로 들려드려요.)
          </IntroHead>
        </Overlay>
        <Hud mode={mode} notice={notice} transcript={transcript} response={response} aboveInput />
        <TextFallback onSend={sendText} />
      </>
    );
  }

  return (
    <>
      {!started && (
        <Overlay variant="intro">
          <IntroHead>한국어 음성으로 대화하는 AI 비서. 웹검색·시간·메모리·리서치 팀을 부려요.</IntroHead>
          <div className="jv-intro-foot">
            {/* 예시 문장 — 누르는 버튼이 아니라 손글씨 메모처럼 보이는 안내 */}
            <p className="jv-suggest">
              <span className="jv-suggest-label">이렇게 말해 보세요</span>
              <span className="jv-suggest-list">
                {EXAMPLES.map((ex) => <span key={ex} className="jv-suggest-item">“{ex}”</span>)}
              </span>
            </p>
            <button className="pol-btn-primary pol-btn-lg jv-btn" onClick={handleStart}>
              <MicIcon /> 음성으로 대화 시작
            </button>
            {notice && (
              <p className="pol-alert jv-alert" role="alert" aria-live="assertive">{notice}</p>
            )}
          </div>
        </Overlay>
      )}
      <Hud mode={mode} notice={notice} transcript={transcript} response={response} />
    </>
  );
}

function Hud({ mode, notice, transcript, response, aboveInput = false }: {
  mode: string; notice: string; transcript: string; response: string; aboveInput?: boolean;
}) {
  return (
    <div className={aboveInput ? "jv-hud is-above-input" : "jv-hud"}>
      <div className="jv-status" role="status" aria-live="polite" data-mode={mode}>
        <span className="jv-dot" aria-hidden="true" />
        {LABEL[mode]}{notice ? <span className="jv-notice"> · {notice}</span> : ""}
      </div>
      {transcript && (
        <div className="jv-transcript" aria-live="polite">나: {transcript}</div>
      )}
      {response && (
        <div className="jv-response" aria-live="polite" aria-atomic="true">{stripMarkdown(response)}</div>
      )}
    </div>
  );
}

function TextFallback({ onSend }: { onSend: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text) return;
    onSend(text);
    el.value = "";
  };
  return (
    <form className="jv-fallback" onSubmit={submit}>
      <textarea
        ref={ref}
        className="pol-textarea jv-input"
        rows={1}
        placeholder="메시지를 입력해 대화하기…"
        aria-label="메시지 입력"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
        }}
      />
      <button type="submit" className="pol-btn-primary jv-send">보내기</button>
    </form>
  );
}

function Overlay({ children, variant }: { children: React.ReactNode; variant: "intro" | "static" }) {
  return <div className={`jv-overlay is-${variant}`}>{children}</div>;
}

// 에디토리얼 표지 머리: 금색 선 라벨 + Fraunces 이탤릭 타이틀 + 리드 문장
function IntroHead({ children }: { children: React.ReactNode }) {
  return (
    <header className="jv-intro-head">
      <p className="pol-eyebrow">음성 AI 비서</p>
      <h1 className="jv-title">JARVIS</h1>
      <p className="jv-sub">{children}</p>
    </header>
  );
}

// 마이크 아이콘 — 버튼 글자색(currentColor)을 따른다
function MicIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}
