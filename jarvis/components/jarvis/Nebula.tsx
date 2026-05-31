// components/jarvis/Nebula.tsx
"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";

// 상태별 네뷸라 색(cityzen Neon · 오브와 동일 팔레트): idle 딤시안 / listening 시안 / thinking 바이올렛 / speaking 시안화이트
const NEBULA_COLORS = [
  new THREE.Color("#2f7d97"),
  new THREE.Color("#5ef2ff"),
  new THREE.Color("#a98bff"),
  new THREE.Color("#9ceaff"),
];

const NebulaMaterial = shaderMaterial(
  { uTime: 0, uAmp: 0, uState: 0, uColor: new THREE.Color("#5ef2ff") },
  /* glsl */ `
    uniform float uTime, uAmp, uState;
    attribute vec3 aDir; attribute float aRadius; attribute float aSeed;
    varying float vGlow;
    void main(){
      float t = uTime + aSeed * 6.2831;
      float spin = t * (0.2 + uState * 0.25);     // thinking일수록 빠르게 공전
      float c = cos(spin), s = sin(spin);
      vec3 d = vec3(aDir.x*c - aDir.z*s, aDir.y, aDir.x*s + aDir.z*c);
      float converge = mix(1.0, 0.5, step(0.5, uState) * step(uState, 1.5)); // listening 응축
      float r = aRadius * converge * (1.0 + uAmp * 0.8) + sin(t*2.0)*0.05;
      vec3 pos = d * r;
      vGlow = 0.4 + uAmp;
      vec4 mv = modelViewMatrix * vec4(pos,1.0);
      gl_PointSize = clamp((1.0 + uAmp * 5.0) * (26.0 / -mv.z), 1.0, 10.0);
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform vec3 uColor; varying float vGlow;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float dd = length(uv);
      if (dd > 0.5) discard;
      float alpha = smoothstep(0.5, 0.0, dd);
      gl_FragColor = vec4(uColor * vGlow * 1.3, alpha);
    }`
);
extend({ NebulaMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { nebulaMaterial: ThreeElement<typeof NebulaMaterial>; }
}

export function Nebula({ count = 4000 }: { count?: number }) {
  const mat = useRef<any>(null!);
  const color = useMemo(() => new THREE.Color("#5ef2ff"), []);
  const { positions, dirs, radii, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      dirs.set([x, y, z], i * 3);
      radii[i] = 1.8 + Math.random() * 2.2;
      seeds[i] = Math.random();
      positions.set([x * radii[i], y * radii[i], z * radii[i]], i * 3);
    }
    return { positions, dirs, radii, seeds };
  }, [count]);

  useFrame((state, delta) => {
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uAmp.value = THREE.MathUtils.lerp(mat.current.uniforms.uAmp.value, audio.amplitude, 0.2);
    mat.current.uniforms.uState.value = STATE.current;
    color.lerp(NEBULA_COLORS[STATE.current] ?? NEBULA_COLORS[0], 1 - Math.pow(0.02, delta));
    mat.current.uniforms.uColor.value.copy(color);
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aDir" args={[dirs, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[radii, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <nebulaMaterial ref={mat} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
