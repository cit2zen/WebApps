// components/jarvis/JarvisScene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Orb } from "./Orb";
import { Nebula } from "./Nebula";

// Polaroid Editorial: 캔버스는 투명(alpha) — 배경은 CSS의 인화지 크림(--bg-base)·조명(--paper-light)·결(.pol-body)이
// 그대로 비친다. 발광 후처리(Bloom·ChromaticAberration·Noise)는 밝은 배경에서 탁해지므로 쓰지 않고,
// 비네팅은 CSS(.jv-stage::after)에서 따뜻한 잉크 톤으로 옅게 준다.
// 오브를 살짝 위로(LIFT_PER_Z·z) 올려 하단 상태/자막 영역과 겹침을 줄인다 — DOM 레티클(.jv-reticle)도 같은 비율로 올림.
const BASE_Z = 6;
const LIFT_PER_Z = 0.35 / BASE_Z; // 카메라 거리 z에서 뷰포트 높이의 6.25% (fov 50) — .jv-reticle의 inset-bottom 12.5%와 짝

// 세로 화면(휴대폰)에서는 레티클이 vmin(=폭) 기준이라 고정 거리 카메라로는 오브가 파형 링·크롭 마크를 넘친다.
// 화면비에 따라 카메라를 물려 오브가 레티클 액자 안에 들어오게 한다(가로 화면은 기존과 동일).
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  useEffect(() => {
    if (!width || !height) return;
    const z = BASE_Z * Math.max(1, (0.85 * height) / width);
    camera.position.set(0, -LIFT_PER_Z * z, z);
    camera.updateMatrixWorld();
  }, [camera, width, height]);
  return null;
}

// 저사양/모바일·prefers-reduced-motion에서 dpr·파티클을 낮춰 발열·프레임드랍·배터리 소모를 줄인다(성능 겸 접근성).
function useQuality() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return { dpr: [1, 2] as [number, number], particles: 3000, reduced: false, lite: false };
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const narrow = window.matchMedia?.("(max-width: 820px)").matches ?? false;
    const lowMem = (navigator as any).deviceMemory ? (navigator as any).deviceMemory <= 4 : false;
    const lite = narrow || lowMem;
    return {
      dpr: (lite ? [1, 1.25] : [1, 1.5]) as [number, number],
      particles: lite ? 1000 : 2600,
      reduced,
      lite,
    };
  }, []);
}

export default function JarvisScene() {
  const q = useQuality();
  return (
    <Canvas
      dpr={q.dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, -LIFT_PER_Z * BASE_Z, BASE_Z], fov: 50 }}
    >
      <CameraRig />
      <Orb reduced={q.reduced} />
      <Nebula count={q.particles} reduced={q.reduced} />
    </Canvas>
  );
}
