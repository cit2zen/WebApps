// app/login/page.tsx — 비밀번호 한 칸 로그인(Polaroid 킷 클래스·토큰만 사용).
"use client";
import { useState } from "react";

function safeNext(): string {
  const n = new URLSearchParams(window.location.search).get("next");
  // 오픈 리다이렉트 방지: 같은 사이트 상대 경로만
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace(safeNext());
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "로그인에 실패했어요.");
    } catch {
      setError("네트워크 오류가 났어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="jv-login">
      <form className="pol-panel jv-login-card" onSubmit={onSubmit}>
        <h1 className="jv-login-title">JARVIS</h1>
        <p className="pol-field-help">이용하려면 비밀번호를 입력하세요.</p>
        <label className="pol-field-label" htmlFor="jv-password">비밀번호</label>
        <input
          id="jv-password"
          className="pol-input"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "jv-login-error" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p id="jv-login-error" className="pol-field-error" role="alert">{error}</p>
        )}
        <button className="pol-btn-primary" type="submit" disabled={busy || !password}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </main>
  );
}
