// components/jarvis/Nebula.tsx
"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";
import { DUST_TONES, SPECK_INK } from "@/lib/palette";

// 금가루 + 잉크 점(Polaroid): 밝은 인화지 배경이라 가산 발광 대신 NormalBlending으로 또렷한 입자.
// 상태별 금가루 톤은 lib/palette.ts(DUST_TONES, 토큰 미러), 잉크 점은 SPECK_INK 공통.
const DUST = DUST_TONES.map((c) => new THREE.Color(c));
const INK = new THREE.Color(SPECK_INK);

const NebulaMaterial = shaderMaterial(
  { uTime: 0, uAmp: 0, uState: 0, uMotion: 1, uColor: DUST[0].clone(), uInk: INK.clone() },
  /* glsl */ `
    uniform float uTime, uAmp, uState, uMotion;
    attribute vec3 aDir; attribute float aRadius; attribute float aSeed;
    varying float vAlpha; varying float vKind;
    void main(){
      float t = uTime + aSeed * 6.2831;
      float spin = t * (0.2 + uState * 0.25) * uMotion;     // thinking일수록 빠르게 공전(reduced-motion 시 정지)
      float c = cos(spin), s = sin(spin);
      vec3 d = vec3(aDir.x*c - aDir.z*s, aDir.y, aDir.x*s + aDir.z*c);
      float converge = mix(1.0, 0.5, step(0.5, uState) * step(uState, 1.5)); // listening 응축
      float r = aRadius * converge * (1.0 + uAmp * 0.8) + sin(t*2.0)*0.05;
      vec3 pos = d * r;
      vKind = step(0.74, fract(aSeed * 7.13));               // 약 26%는 잉크 점, 나머지는 금가루
      vAlpha = clamp(0.42 + uState * 0.08 + uAmp * 0.45, 0.0, 0.95);
      vec4 mv = modelViewMatrix * vec4(pos,1.0);
      gl_PointSize = clamp((0.9 + uAmp * 3.0) * (22.0 / -mv.z) * mix(1.0, 0.75, vKind), 1.0, 6.0);
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform vec3 uColor, uInk; varying float vAlpha; varying float vKind;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float dd = length(uv);
      if (dd > 0.5) discard;
      float alpha = smoothstep(0.5, 0.22, dd) * vAlpha;
      gl_FragColor = vec4(mix(uColor, uInk, vKind), alpha);
      #include <colorspace_fragment>
    }`
);
extend({ NebulaMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { nebulaMaterial: ThreeElement<typeof NebulaMaterial>; }
}

export function Nebula({ count = 4000, reduced = false }: { count?: number; reduced?: boolean }) {
  const mat = useRef<any>(null!);
  const color = useMemo(() => DUST[0].clone(), []);
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
    mat.current.uniforms.uMotion.value = reduced ? 0 : 1; // reduced-motion 시 공전 정지, 색전이만 유지
    color.lerp(DUST[STATE.current] ?? DUST[0], 1 - Math.pow(0.02, delta));
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
      <nebulaMaterial ref={mat} transparent depthWrite={false} toneMapped={false} />
    </points>
  );
}
