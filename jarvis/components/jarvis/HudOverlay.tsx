// components/jarvis/HudOverlay.tsx
// 오브 위에 겹치는 레티클(Polaroid): 금색 헤어라인 회전 링 + 실시간 음성 파형(원형) + 사진 모서리 크롭 마크.
// 3D Canvas와 분리된 DOM 오버레이라 GPU 부담이 적고 선명하다. pointer-events 없음.
// 색: DOM(SVG·크롭 마크)은 var(--gold-*) 토큰, 2D 캔버스 파형은 lib/palette.ts의 토큰 미러 hex.
"use client";
import { useEffect, useRef } from "react";
import { useJarvisStore } from "@/lib/store";
import { audio, type Mode } from "@/lib/audioBus";
import { MODE_ACCENT } from "@/lib/palette";

export function HudOverlay() {
  const mode = useJarvisStore((s) => s.mode);
  const accent = MODE_ACCENT[mode as Mode] ?? MODE_ACCENT.idle;
  const accentRef = useRef(accent.hex);
  accentRef.current = accent.hex;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0, smooth = 0;

    function resize() {
      const s = Math.min(window.innerWidth, window.innerHeight) * 0.72;
      cv!.width = s * dpr; cv!.height = s * dpr;
      cv!.style.width = `${s}px`; cv!.style.height = `${s}px`;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      raf = requestAnimationFrame(draw);
      const w = cv!.width, h = cv!.height, cx = w / 2, cy = h / 2;
      ctx!.clearRect(0, 0, w, h);
      smooth += (audio.amplitude - smooth) * 0.2;
      const tt = reduced ? 0 : performance.now() * 0.001;
      const r0 = Math.min(w, h) * 0.34;
      const bars = 96;
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.strokeStyle = accentRef.current;
      ctx!.lineWidth = Math.max(1.1 * dpr, 1.2);
      ctx!.lineCap = "round";
      ctx!.globalAlpha = 0.8;
      // 모든 막대를 단일 경로로 모아 한 번만 stroke (per-stroke shadowBlur는 치명적 비용 — 밝은 배경이라 글로우 없음)
      ctx!.beginPath();
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2;
        const band = audio.bands[i % 5] || 0;
        const wob = 0.5 + 0.5 * Math.sin(i * 0.6 + tt * 2.0);
        const v = (0.06 + smooth * 0.85 + band * 0.4) * (0.35 + 0.65 * wob);
        const len = Math.min(w, h) * (0.02 + v * 0.16);
        const ca = Math.cos(a), sa = Math.sin(a);
        ctx!.moveTo(ca * r0, sa * r0);
        ctx!.lineTo(ca * (r0 + len), sa * (r0 + len));
      }
      ctx!.stroke();
      ctx!.restore();
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div className="jv-reticle" aria-hidden="true" data-mode={mode} style={{ ["--hud" as any]: accent.token }}>
      <canvas ref={canvasRef} className="jv-hud-wave" />
      <svg className="jv-hud-svg" viewBox="0 0 200 200">
        {/* 바깥 회전 점선 링 */}
        <circle className="jv-ring jv-ring-a" cx="100" cy="100" r="92" fill="none" stroke="var(--hud)" strokeWidth="0.4" strokeDasharray="1.5 6" />
        {/* 호 세그먼트 링(반대 회전) */}
        <g className="jv-ring jv-ring-b">
          <circle cx="100" cy="100" r="82" fill="none" stroke="var(--hud)" strokeWidth="0.6" strokeDasharray="40 220" strokeLinecap="round" opacity="0.9" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="var(--hud)" strokeWidth="0.6" strokeDasharray="18 90" strokeDashoffset="130" strokeLinecap="round" opacity="0.5" />
        </g>
        {/* 눈금 링 */}
        <g className="jv-ring jv-ring-c" opacity="0.55">
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={i} x1="100" y1="14" x2="100" y2={i % 5 === 0 ? "20" : "17"} stroke="var(--hud)" strokeWidth="0.35"
              transform={`rotate(${i * 6} 100 100)`} />
          ))}
        </g>
      </svg>
      {/* 사진 모서리 크롭 마크 — 레티클 정사각형을 액자처럼 두른다 */}
      <div className="jv-frame">
        <span className="jv-bracket jv-tl" /><span className="jv-bracket jv-tr" />
        <span className="jv-bracket jv-bl" /><span className="jv-bracket jv-br" />
      </div>
    </div>
  );
}
