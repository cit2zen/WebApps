import * as THREE from 'three';
import { makeFlameTexture, makeGlowTexture, makeBarrelTexture } from './textures.js';

let flameTex = null, glowTex = null, barrelSet = null;
const flame = () => (flameTex ||= makeFlameTexture());
const glow = () => (glowTex ||= makeGlowTexture());
const barrelS = () => (barrelSet ||= makeBarrelTexture());

const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.85, metalness: 0.1 });
const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 14);
const pillarGeo = new THREE.BoxGeometry(1.1, 4, 1.1);

// 횃불: 벽 기둥 + 발광 불꽃 스프라이트 + 플리커용 PointLight
export function makeTorch(color) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 0.7;
  pole.castShadow = true;
  pole.receiveShadow = true;
  group.add(pole);

  const fmat = new THREE.SpriteMaterial({
    map: flame(), color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const f = new THREE.Sprite(fmat);
  f.scale.set(0.8, 1.1, 1);
  f.position.y = 1.55;
  group.add(f);

  // soft area glow halo
  const gmat = new THREE.SpriteMaterial({
    map: glow(), color, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Sprite(gmat);
  halo.scale.set(3.2, 3.2, 1);
  halo.position.y = 1.55;
  group.add(halo);

  // level torches don't cast shadows (performance) per CONTRACT
  const light = new THREE.PointLight(color, 3.6, 24, 1.3);
  light.castShadow = false;
  light.position.set(0, 1.6, 0);
  group.add(light);
  return { mesh: group, light, base: 3.6 };
}

export function makeBarrel() {
  const bs = barrelS();
  const mat = new THREE.MeshStandardMaterial({
    map: bs.map,
    normalMap: bs.normalMap,
    roughnessMap: bs.roughnessMap,
    roughness: 0.85,
    metalness: 0.05,
  });
  const m = new THREE.Mesh(barrelGeo, mat);
  m.position.y = 0.7;
  m.castShadow = true;
  m.receiveShadow = true;
  return { mesh: m, mat };
}

export function makePillar(theme) {
  const pbr = theme.pbr ?? { wallRough: 0.9, metal: 0.0, envIntensity: 0.28 };
  const mat = new THREE.MeshStandardMaterial({
    color: parseInt(theme.wall[1].slice(1), 16),
    roughness: pbr.wallRough,
    metalness: pbr.metal,
    envMapIntensity: pbr.envIntensity,
  });
  const m = new THREE.Mesh(pillarGeo, mat);
  m.position.y = 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return { mesh: m, mat };
}
