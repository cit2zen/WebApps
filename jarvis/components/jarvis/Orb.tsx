// components/jarvis/Orb.tsx
"use client";
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";

// 상태별 기본 색: idle 청회색 / listening 시안 / thinking 보라 / speaking 시안화이트
const STATE_COLORS = [
  new THREE.Color("#2b6f9e"),
  new THREE.Color("#22e0ff"),
  new THREE.Color("#a366ff"),
  new THREE.Color("#9af3ff"),
];

const FresnelMaterial = shaderMaterial(
  { uTime: 0, uIntensity: 1, uColor: new THREE.Color("#22e0ff") },
  /* glsl */ `
    varying vec3 vNormal; varying vec3 vViewDir;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform float uTime; uniform float uIntensity; uniform vec3 uColor;
    varying vec3 vNormal; varying vec3 vViewDir;
    void main(){
      float fres = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
      float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
      vec3 col = uColor * fres * uIntensity * pulse * 2.2; // >1 → Bloom이 집어감
      gl_FragColor = vec4(col, fres);
    }`
);
extend({ FresnelMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { fresnelMaterial: ThreeElement<typeof FresnelMaterial>; }
}

export function Orb() {
  const mesh = useRef<THREE.Mesh>(null!);
  const mat = useRef<any>(null!);
  const color = useMemo(() => new THREE.Color("#22e0ff"), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const amp = audio.amplitude;
    mat.current.uniforms.uTime.value = t;
    mat.current.uniforms.uIntensity.value = THREE.MathUtils.lerp(
      mat.current.uniforms.uIntensity.value, 1 + amp * 3, 0.15
    );
    // 상태 색 부드럽게 전이
    color.lerp(STATE_COLORS[STATE.current] ?? STATE_COLORS[0], 1 - Math.pow(0.015, delta));
    mat.current.uniforms.uColor.value.copy(color);
    // 호흡 + 진폭 스케일 (프레임 독립)
    const target = 1 + amp * 0.4 + Math.sin(t * 1.5) * 0.03;
    const s = THREE.MathUtils.lerp(mesh.current.scale.x, target, 1 - Math.pow(0.001, delta));
    mesh.current.scale.setScalar(s);
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 8]} />
      <fresnelMaterial
        ref={mat}
        transparent
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
