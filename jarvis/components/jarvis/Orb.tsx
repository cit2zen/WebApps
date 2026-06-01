// components/jarvis/Orb.tsx
// 아크리액터 코어: 안쪽 플라즈마 코어(FBM 노이즈, 음성반응 변위·발광) +
// 공전하는 에너지 링 + 바깥 Fresnel 헤일로. 상태별 색/모션이 다르다.
"use client";
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";

// idle 딤시안 / listening 시안 / thinking 바이올렛 / speaking 시안화이트
const STATE_COLORS = [
  new THREE.Color("#2f7d97"),
  new THREE.Color("#5ef2ff"),
  new THREE.Color("#a98bff"),
  new THREE.Color("#b4f6ff"),
];
const HOT = new THREE.Color("#eaffff");

const NOISE = /* glsl */ `
  float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.0; a*=0.5;} return s; }
`;

// 플라즈마 코어 — 표면이 노이즈로 끓고, 음성 진폭으로 돌출/발광한다.
const PlasmaMaterial = shaderMaterial(
  { uTime: 0, uAmp: 0, uDisp: 0.06, uColor: new THREE.Color("#5ef2ff"), uHot: HOT.clone() },
  /* glsl */ `
    uniform float uTime, uAmp, uDisp;
    varying vec3 vN; varying vec3 vView; varying float vNz; varying vec3 vPos;
    ${NOISE}
    void main(){
      vec3 p = position;
      float n = fbm(p*2.2 + vec3(0.0, uTime*0.25, uTime*0.18));
      float d = (n - 0.5) * (uDisp + uAmp*0.30);   // 음성 진폭으로 표면 일렁임
      vec3 dp = p + normal * d;
      vNz = n; vPos = p;
      vec4 mv = modelViewMatrix * vec4(dp,1.0);
      vN = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform float uTime, uAmp; uniform vec3 uColor, uHot;
    varying vec3 vN; varying vec3 vView; varying float vNz; varying vec3 vPos;
    ${NOISE}
    void main(){
      float fres = pow(1.0 - max(dot(vN, vView), 0.0), 2.5);
      float veins = fbm(vPos*3.5 + vec3(uTime*0.4, -uTime*0.3, uTime*0.2));
      float hot = smoothstep(0.45, 0.9, veins + uAmp*0.4);
      vec3 col = mix(uColor, uHot, hot*0.7);
      float emit = (0.45 + veins*0.7 + fres*1.1) * (1.5 + uAmp*2.2);
      gl_FragColor = vec4(col * emit, clamp(fres + hot*0.5 + 0.25, 0.0, 1.0));
    }`
);
const HaloMaterial = shaderMaterial(
  { uTime: 0, uIntensity: 1, uColor: new THREE.Color("#5ef2ff") },
  /* glsl */ `varying vec3 vN; varying vec3 vView;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal);
      vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  /* glsl */ `uniform float uTime,uIntensity; uniform vec3 uColor; varying vec3 vN; varying vec3 vView;
    void main(){ float f=pow(1.0-max(dot(vN,vView),0.0),3.0);
      float pulse=0.85+0.15*sin(uTime*2.0);
      gl_FragColor=vec4(uColor*f*uIntensity*pulse*2.4, f); }`
);
extend({ PlasmaMaterial, HaloMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements {
    plasmaMaterial: ThreeElement<typeof PlasmaMaterial>;
    haloMaterial: ThreeElement<typeof HaloMaterial>;
  }
}

export function Orb({ reduced = false }: { reduced?: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const core = useRef<THREE.Mesh>(null!);
  const plasma = useRef<any>(null!);
  const halo = useRef<any>(null!);
  const ringA = useRef<THREE.Mesh>(null!);
  const ringB = useRef<THREE.Mesh>(null!);
  const color = useMemo(() => new THREE.Color("#5ef2ff"), []);
  const breathe = reduced ? 0 : 0.03;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const amp = audio.amplitude;
    const st = STATE.current;
    color.lerp(STATE_COLORS[st] ?? STATE_COLORS[0], 1 - Math.pow(0.015, delta));

    plasma.current.uniforms.uTime.value = t;
    plasma.current.uniforms.uAmp.value = THREE.MathUtils.lerp(plasma.current.uniforms.uAmp.value, amp, 0.15);
    plasma.current.uniforms.uDisp.value = reduced ? 0.02 : 0.06;
    plasma.current.uniforms.uColor.value.copy(color);

    halo.current.uniforms.uTime.value = t;
    halo.current.uniforms.uIntensity.value = THREE.MathUtils.lerp(halo.current.uniforms.uIntensity.value, 1 + amp * 3, 0.15);
    halo.current.uniforms.uColor.value.copy(color);

    // 호흡 + 진폭 스케일
    const target = 1 + amp * 0.35 + Math.sin(t * 1.5) * breathe;
    const s = THREE.MathUtils.lerp(core.current.scale.x, target, 1 - Math.pow(0.001, delta));
    group.current.scale.setScalar(s);

    // 에너지 링 공전 — thinking일수록 빠르게, reduced 시 정지
    const spin = reduced ? 0 : (0.3 + st * 0.35 + amp * 1.2);
    ringA.current.rotation.z += spin * delta;
    ringA.current.rotation.x = 1.2 + Math.sin(t * 0.3) * 0.15;
    ringB.current.rotation.z -= spin * 0.7 * delta;
    ringB.current.rotation.y = 0.6 + Math.cos(t * 0.25) * 0.15;
    (ringA.current.material as THREE.MeshBasicMaterial).color.copy(color);
    (ringB.current.material as THREE.MeshBasicMaterial).color.copy(color);
  });

  return (
    <group ref={group}>
      {/* 플라즈마 코어 */}
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 12]} />
        <plasmaMaterial ref={plasma} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Fresnel 헤일로 */}
      <mesh scale={1.12}>
        <icosahedronGeometry args={[1, 6]} />
        <haloMaterial ref={halo} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* 공전 에너지 링 */}
      <mesh ref={ringA} rotation={[1.2, 0, 0]}>
        <torusGeometry args={[1.5, 0.018, 12, 140]} />
        <meshBasicMaterial color="#5ef2ff" toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation={[0.4, 0.6, 0]}>
        <torusGeometry args={[1.85, 0.012, 12, 160]} />
        <meshBasicMaterial color="#5ef2ff" toneMapped={false} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}
