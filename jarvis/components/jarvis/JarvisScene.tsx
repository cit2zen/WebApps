// components/jarvis/JarvisScene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useMemo } from "react";
import { Orb } from "./Orb";
import { Nebula } from "./Nebula";

// 저사양/모바일·prefers-reduced-motion에서 dpr·파티클·Bloom·포스트를 낮춰
// 발열·프레임드랍·배터리 소모를 줄인다(성능 겸 접근성).
function useQuality() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return { dpr: [1, 2] as [number, number], particles: 3000, bloom: 0.9, reduced: false, lite: false };
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const narrow = window.matchMedia?.("(max-width: 820px)").matches ?? false;
    const lowMem = (navigator as any).deviceMemory ? (navigator as any).deviceMemory <= 4 : false;
    const lite = narrow || lowMem;
    return {
      dpr: (lite ? [1, 1.25] : [1, 1.5]) as [number, number],
      particles: lite ? 1000 : 2600,
      bloom: lite ? 0.6 : 0.9,
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
      gl={{ antialias: q.dpr[1] >= 2, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 50 }}
    >
      <color attach="background" args={["#06060b"]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} />
      <Orb reduced={q.reduced} />
      <Nebula count={q.particles} reduced={q.reduced} />
      {/* multisampling 0 — 일부 ANGLE/AMD 드라이버에서 MSAA+포스트가 깜빡임 유발 → 끔 */}
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={q.bloom} luminanceThreshold={0.65} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.22} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
