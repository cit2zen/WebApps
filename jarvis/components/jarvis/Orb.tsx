// components/jarvis/Orb.tsx
// 인화지 위의 금박 구(Polaroid Editorial): 안쪽 코어(FBM 노이즈 변위 + 판화 같은 잉크 등고선, 음성반응) +
// 공전하는 금색 헤어라인 링 + 옅은 금빛 번짐(Fresnel). 밝은 배경이라 가산 발광 대신 NormalBlending.
// 상태별 톤/모션은 lib/palette.ts의 ORB_TONES(토큰 미러)에서 온다.
"use client";
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";
import { ORB_TONES } from "@/lib/palette";

const TONES = ORB_TONES.map((t) => ({
  base: new THREE.Color(t.base),
  ink: new THREE.Color(t.ink),
  hi: new THREE.Color(t.hi),
  ring: new THREE.Color(t.ring),
  energy: t.energy,
  halo: t.halo,
  flow: t.flow,
}));

const NOISE = /* glsl */ `
  float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.0; a*=0.5;} return s; }
`;

// 금박 코어 — 표면이 노이즈로 일렁이고, 흐르는 잉크 등고선이 음성 진폭에 굵어진다.
const PlasmaMaterial = shaderMaterial(
  {
    uTime: 0, uAmp: 0, uDisp: 0.06, uEnergy: 0.5,
    uColor: TONES[0].base.clone(), uInk: TONES[0].ink.clone(), uHi: TONES[0].hi.clone(),
  },
  /* glsl */ `
    uniform float uTime, uAmp, uDisp;
    varying vec3 vN; varying vec3 vView; varying vec3 vPos;
    ${NOISE}
    void main(){
      vec3 p = position;
      float n = fbm(p*2.2 + vec3(0.0, uTime*0.25, uTime*0.18));
      float d = (n - 0.5) * (uDisp + uAmp*0.30);   // 음성 진폭으로 표면 일렁임
      vec3 dp = p + normal * d;
      vPos = p;
      vec4 mv = modelViewMatrix * vec4(dp,1.0);
      vN = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform float uTime, uAmp, uEnergy; uniform vec3 uColor, uInk, uHi;
    varying vec3 vN; varying vec3 vView; varying vec3 vPos;
    ${NOISE}
    void main(){
      vec3 n = normalize(vN);
      float ndv = max(dot(n, vView), 0.0);
      float fres = pow(1.0 - ndv, 2.2);
      // 좌상단 조명 — 종이 위 구체의 부드러운 음영
      vec3 L = normalize(vec3(-0.45, 0.6, 0.65));
      float diff = max(dot(n, L), 0.0);
      vec3 col = uColor * (0.66 + 0.44 * diff);
      vec3 H = normalize(L + vView);
      col = mix(col, uHi, pow(max(dot(n, H), 0.0), 24.0) * 0.6);
      // 판화 등고선: fbm 등고선이 흐르고, 발화 진폭에 굵어진다
      float f = fbm(vPos*2.6 + vec3(uTime*0.22, -uTime*0.17, uTime*0.12));
      float band = abs(fract(f * 10.0) - 0.5);
      float w = 0.03 + uAmp * 0.09;
      float line = 1.0 - smoothstep(w, w + 0.045, band);
      col = mix(col, uInk, line * uEnergy);
      // 얇은 잉크 윤곽 — 크림 배경에서 실루엣을 또렷하게
      col = mix(col, uInk, smoothstep(0.4, 1.0, fres) * 0.55);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`
);
// 금빛 번짐 — 가장자리에서만 옅게(NormalBlending, 알파로 세기 조절)
const HaloMaterial = shaderMaterial(
  { uTime: 0, uIntensity: 1, uColor: TONES[0].base.clone() },
  /* glsl */ `varying vec3 vN; varying vec3 vView;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal);
      vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  /* glsl */ `uniform float uTime,uIntensity; uniform vec3 uColor; varying vec3 vN; varying vec3 vView;
    void main(){ float f=pow(1.0-max(dot(normalize(vN),vView),0.0),3.0);
      float pulse=0.85+0.15*sin(uTime*2.0);
      gl_FragColor=vec4(uColor, clamp(f*uIntensity*pulse*0.42, 0.0, 0.7));
      #include <colorspace_fragment>
    }`
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
  const cur = useMemo(() => ({
    base: TONES[0].base.clone(), ink: TONES[0].ink.clone(), hi: TONES[0].hi.clone(), ring: TONES[0].ring.clone(),
    energy: TONES[0].energy, halo: TONES[0].halo, flow: TONES[0].flow, time: 0,
  }), []);
  const breathe = reduced ? 0 : 0.03;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const amp = audio.amplitude;
    const st = STATE.current;
    const tone = TONES[st] ?? TONES[0];
    const k = 1 - Math.pow(0.015, delta);
    cur.base.lerp(tone.base, k);
    cur.ink.lerp(tone.ink, k);
    cur.hi.lerp(tone.hi, k);
    cur.ring.lerp(tone.ring, k);
    cur.energy = THREE.MathUtils.lerp(cur.energy, tone.energy, k);
    cur.halo = THREE.MathUtils.lerp(cur.halo, tone.halo, k);
    cur.flow = THREE.MathUtils.lerp(cur.flow, tone.flow, k);
    // 등고선 흐름 시간 — 상태별 속도(thinking 가장 빠름), reduced 시 거의 정지
    cur.time += delta * cur.flow * (reduced ? 0.15 : 1);

    const pu = plasma.current.uniforms;
    pu.uTime.value = cur.time;
    pu.uAmp.value = THREE.MathUtils.lerp(pu.uAmp.value, amp, 0.15);
    pu.uDisp.value = reduced ? 0.02 : 0.06;
    pu.uEnergy.value = cur.energy;
    pu.uColor.value.copy(cur.base);
    pu.uInk.value.copy(cur.ink);
    pu.uHi.value.copy(cur.hi);

    const hu = halo.current.uniforms;
    hu.uTime.value = t;
    hu.uIntensity.value = THREE.MathUtils.lerp(hu.uIntensity.value, cur.halo + amp * 2.2, 0.15);
    hu.uColor.value.copy(cur.base);

    // 호흡 + 진폭 스케일 (listening/speaking은 진폭으로 커진다)
    const target = 1 + amp * 0.35 + Math.sin(t * 1.5) * breathe;
    const s = THREE.MathUtils.lerp(core.current.scale.x, target, 1 - Math.pow(0.001, delta));
    group.current.scale.setScalar(s);

    // 헤어라인 링 공전 — thinking일수록 빠르게, reduced 시 정지
    const spin = reduced ? 0 : (0.3 + st * 0.35 + amp * 1.2);
    ringA.current.rotation.z += spin * delta;
    ringA.current.rotation.x = 1.2 + Math.sin(t * 0.3) * 0.15;
    ringB.current.rotation.z -= spin * 0.7 * delta;
    ringB.current.rotation.y = 0.6 + Math.cos(t * 0.25) * 0.15;
    (ringA.current.material as THREE.MeshBasicMaterial).color.copy(cur.ring);
    (ringB.current.material as THREE.MeshBasicMaterial).color.copy(cur.ring);
  });

  return (
    <group ref={group}>
      {/* 금박 코어(불투명) */}
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 12]} />
        <plasmaMaterial ref={plasma} toneMapped={false} />
      </mesh>
      {/* 금빛 번짐 */}
      <mesh scale={1.12}>
        <icosahedronGeometry args={[1, 6]} />
        <haloMaterial ref={halo} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* 공전 헤어라인 링 */}
      <mesh ref={ringA} rotation={[1.2, 0, 0]}>
        <torusGeometry args={[1.5, 0.007, 8, 180]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation={[0.4, 0.6, 0]}>
        <torusGeometry args={[1.85, 0.005, 8, 200]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}
