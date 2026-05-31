// components/jarvis/JarvisCanvas.tsx
"use client";
import dynamic from "next/dynamic";

const JarvisScene = dynamic(() => import("./JarvisScene"), {
  ssr: false,
  loading: () => null,
});

export function JarvisCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <JarvisScene />
    </div>
  );
}
