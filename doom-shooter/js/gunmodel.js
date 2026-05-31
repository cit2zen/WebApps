import * as THREE from 'three';
import { makeFlameTexture } from './textures.js';

// 3D pistol viewmodel. Returns { group, mag, muzzle, magBaseY, slide }.
// slide.userData.baseZ holds the rest z; weapon.js animates slide.position.z for recoil.
export function buildGun() {
  const group = new THREE.Group();

  // PBR materials — fog:false (camera-attached viewmodel), no shadows, low envMapIntensity
  const _pbrBase = { metalness: 0.7, roughness: 0.4, envMapIntensity: 0.2, fog: false };
  const steel   = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x484b57, emissive: 0x0d0e12 });
  const steelHi = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x686c7a, emissive: 0x10111a });
  const dark    = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x1a1b20, roughness: 0.55 });
  const grey    = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x2c2e38, roughness: 0.5 });
  const greyHi  = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x4a4d5a, roughness: 0.35 });
  const black   = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x0d0d0f, roughness: 0.6, metalness: 0.3 });
  const copper  = new THREE.MeshStandardMaterial({ ..._pbrBase, color: 0x7a4a22, emissive: 0x1a0a00, roughness: 0.5, metalness: 0.6 });

  // Helper: create a box mesh and add it to a parent group
  const box = (w, h, d, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ── Slide (top reciprocating part) ──────────────────────────────────────
  // Built as its own group so weapon.js can translate it independently.
  const slideGroup = new THREE.Group();
  slideGroup.position.set(0, 0, 0);
  group.add(slideGroup);

  // Main slide body
  box(0.13, 0.13, 0.44, steel, 0, 0, 0, slideGroup);

  // Highlight strip along the top
  box(0.04, 0.006, 0.44, steelHi, 0, 0.068, 0, slideGroup);

  // Serration ridges on rear of slide (tactile grip area)
  for (let i = 0; i < 5; i++) {
    box(0.134, 0.13, 0.005, i % 2 === 0 ? dark : steelHi, 0, 0, 0.09 + i * 0.022, slideGroup);
  }

  // Ejection port cutout — represented as a recessed dark rect on the right side
  const ejectPort = box(0.003, 0.045, 0.09, black, 0.066, 0.01, -0.06, slideGroup);
  ejectPort.renderOrder = 6;

  // Ejection port rim highlight (thin bright edge above port)
  box(0.003, 0.005, 0.09, greyHi, 0.066, 0.035, -0.06, slideGroup);

  // Partially visible cartridge in port (copper colour, tiny)
  box(0.012, 0.032, 0.05, copper, 0.055, 0.012, -0.055, slideGroup);

  // Rear sight on slide
  box(0.022, 0.028, 0.018, grey, 0, 0.078, 0.17, slideGroup);
  // Sight notch highlight dots
  box(0.005, 0.005, 0.003, greyHi, -0.007, 0.084, 0.162, slideGroup);
  box(0.005, 0.005, 0.003, greyHi, 0.007, 0.084, 0.162, slideGroup);

  // Front sight on slide
  box(0.018, 0.028, 0.012, grey, 0, 0.078, -0.3, slideGroup);
  box(0.005, 0.005, 0.003, greyHi, 0, 0.084, -0.308, slideGroup);

  // Record rest position for recoil animation
  slideGroup.userData.baseZ = slideGroup.position.z;
  const slide = slideGroup;

  // ── Frame / lower receiver ───────────────────────────────────────────────
  // Barrel block (under slide, slightly recessed)
  box(0.095, 0.072, 0.18, dark, 0, -0.028, -0.22);

  // Muzzle crown ring
  box(0.052, 0.052, 0.055, dark, 0, -0.008, -0.42);
  // Bright muzzle bore highlight
  box(0.024, 0.024, 0.058, black, 0, -0.008, -0.42);

  // Dust-cover / rail section under barrel
  box(0.1, 0.03, 0.22, grey, 0, -0.076, -0.18);
  // Picatinny rail teeth
  for (let i = 0; i < 4; i++) {
    box(0.102, 0.008, 0.018, greyHi, 0, -0.062, -0.08 - i * 0.032);
  }

  // Trigger guard
  const tg = box(0.095, 0.01, 0.13, grey, 0, -0.115, 0.04);
  // Guard curve approximation (front post)
  box(0.095, 0.06, 0.01, grey, 0, -0.085, -0.025);

  // Trigger
  box(0.012, 0.04, 0.008, dark, 0, -0.104, 0.015);

  // Grip frame — angled back like a real pistol
  const grip = box(0.11, 0.28, 0.13, grey, 0, -0.20, 0.115);
  grip.rotation.x = 0.28;

  // Grip texture panels (stippling simulation via slightly raised strips)
  for (let i = 0; i < 3; i++) {
    const panel = box(0.113, 0.06, 0.005, dark, 0, -0.135 - i * 0.065, 0.182);
    panel.rotation.x = 0.28;
  }

  // Backstrap highlight
  const bs = box(0.008, 0.24, 0.005, greyHi, 0.056, -0.20, 0.065);
  bs.rotation.x = 0.28;

  // Magazine ─────────────────────────────────────────────────────────────
  const mag = box(0.085, 0.24, 0.1, dark, 0, -0.215, 0.118);
  mag.rotation.x = 0.28;
  const magBaseY = mag.position.y;

  // Magazine base plate
  const magBase = box(0.092, 0.012, 0.108, black, 0, -0.34, 0.13);
  magBase.rotation.x = 0.28;

  // ── Muzzle flash plane ─────────────────────────────────────────────────
  const mt = makeFlameTexture();
  const muzzle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({
      map: mt,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      color: 0xffd27a,
    })
  );
  muzzle.position.set(0, -0.008, -0.52);
  muzzle.visible = false;
  group.add(muzzle);

  group.traverse((o) => { o.renderOrder = 5; });
  return { group, mag, muzzle, magBaseY, slide };
}
