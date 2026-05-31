// components/jarvis/JarvisScene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Orb } from "./Orb";
import { Nebula } from "./Nebula";

export default function JarvisScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 50 }}
    >
      <color attach="background" args={["#02030a"]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} />
      <Orb />
      <Nebula count={3000} />
      <EffectComposer>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.7} luminanceSmoothing={0.3} />
      </EffectComposer>
    </Canvas>
  );
}
