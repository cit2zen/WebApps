import * as THREE from 'three';
import { buildGun } from './gunmodel.js';
import { makeFlameTexture } from './textures.js';

// ─── Stats ──────────────────────────────────────────────────────────────────
export const WEAPONS = {
  pistol: {
    name: 'PISTOL',
    damage: 20,
    pellets: 1,
    spread: 0,
    fireRate: 0.22,   // seconds between shots
    mag: 12,
    reserveMax: 60,
    auto: false,
    kick: 0.045,
  },
  shotgun: {
    name: 'SHOTGUN',
    damage: 8,
    pellets: 7,
    spread: 0.12,
    fireRate: 0.85,
    mag: 6,
    reserveMax: 36,
    auto: false,
    kick: 0.09,
  },
  mg: {
    name: 'MACHINEGUN',
    damage: 9,
    pellets: 1,
    spread: 0.03,
    fireRate: 0.09,
    mag: 30,
    reserveMax: 150,
    auto: true,
    kick: 0.03,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Steel-class material (metallic, smooth-ish)
function matSteel(color, emissive = 0x000000, roughness = 0.45, metalness = 0.85) {
  return new THREE.MeshStandardMaterial({
    color, emissive, roughness, metalness,
    envMapIntensity: 0.3,
    fog: false,
  });
}

// Wood-class material (non-metal, rough)
function matWood(color, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.82, metalness: 0.0,
    envMapIntensity: 0.1,
    fog: false,
  });
}

// Olive/polymer-class material (non-metal, medium rough)
function matOlive(color, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color, emissive, roughness: 0.72, metalness: 0.0,
    envMapIntensity: 0.15,
    fog: false,
  });
}

// Generic mat — steel by default (backward-compat for black/yellow accents)
function mat(color, emissive = 0x000000) {
  return matSteel(color, emissive);
}

let _grp = null;   // default parent for box() within the current builder
function box(w, h, d, material, x, y, z, parent = _grp) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function makeMuzzle(parent) {
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
  muzzle.visible = false;
  parent.add(muzzle);
  return muzzle;
}

// ─── Pistol ──────────────────────────────────────────────────────────────────
function buildPistol() {
  return buildGun(); // reuse existing detailed model
}

// ─── Shotgun ─────────────────────────────────────────────────────────────────
function buildShotgun() {
  const group = new THREE.Group();
  _grp = group;

  const steelDark = matSteel(0x2e2e30, 0x000000, 0.50, 0.80);
  const steelMid  = matSteel(0x4a4a50, 0x0a0a0c, 0.42, 0.85);
  const steelHi   = matSteel(0x72727a, 0x111116, 0.30, 0.90);
  const wood      = matWood(0x5a3010,  0x100800);
  const woodHi    = matWood(0x7a4820,  0x120a00);
  const black     = matSteel(0x0d0d0f, 0x000000, 0.60, 0.70);

  // Slide group (pump — slides on z axis for recoil)
  const slideGroup = new THREE.Group();
  group.add(slideGroup);

  // Twin barrels side-by-side
  const barrelW = 0.055, barrelH = 0.055, barrelL = 0.58;
  box(barrelW, barrelH, barrelL, steelMid,  0.038, 0.02, -0.22, slideGroup);
  box(barrelW, barrelH, barrelL, steelMid, -0.038, 0.02, -0.22, slideGroup);
  // Barrel rib between them
  box(0.012, 0.008, barrelL, steelHi, 0, 0.052, -0.22, slideGroup);
  // Muzzle crowns
  box(0.045, 0.045, 0.02, steelHi,  0.038, 0.02, -0.52, slideGroup);
  box(0.045, 0.045, 0.02, steelHi, -0.038, 0.02, -0.52, slideGroup);
  // Bore holes
  box(0.026, 0.026, 0.024, black,  0.038, 0.02, -0.524, slideGroup);
  box(0.026, 0.026, 0.024, black, -0.038, 0.02, -0.524, slideGroup);

  // Fore-end (pump handle)
  box(0.15, 0.065, 0.14, woodHi, 0, -0.016, -0.12, slideGroup);
  for (let i = 0; i < 5; i++) {
    box(0.153, 0.004, 0.008, steelDark, 0, -0.016, -0.065 + i * 0.022, slideGroup);
  }

  slideGroup.userData.baseZ = 0;
  const slide = slideGroup;

  // Receiver body
  box(0.16, 0.11, 0.28, steelDark, 0, 0.015, 0.09);
  box(0.162, 0.008, 0.28, steelHi, 0, 0.072, 0.09); // top rib
  // Ejection port
  box(0.004, 0.048, 0.08, black, 0.082, 0.018, 0.06);

  // Trigger guard
  box(0.16, 0.01, 0.1, steelMid, 0, -0.055, 0.06);
  box(0.16, 0.05, 0.01, steelMid, 0, -0.03, 0.012);
  // Trigger
  box(0.014, 0.038, 0.008, black, 0, -0.046, 0.042);

  // Stock / grip (wood)
  const stock = box(0.13, 0.26, 0.18, wood, 0, -0.16, 0.22);
  stock.rotation.x = 0.18;
  const stockHi = box(0.132, 0.06, 0.005, woodHi, 0, -0.11, 0.32);
  stockHi.rotation.x = 0.18;

  // Magazine tube under barrel
  const mag = box(0.038, 0.038, 0.48, steelDark, 0, -0.03, -0.19);
  const magBaseY = mag.position.y;

  // Muzzle flash between the two barrels
  const muzzle = makeMuzzle(group);
  muzzle.position.set(0, 0.02, -0.56);

  group.traverse(o => { o.renderOrder = 5; });
  return { group, mag, muzzle, magBaseY, slide };
}

// ─── Machine Gun ─────────────────────────────────────────────────────────────
function buildMachinegun() {
  const group = new THREE.Group();
  _grp = group;

  const steelDark  = matSteel(0x1e2025, 0x000000, 0.50, 0.82);
  const steelMid   = matSteel(0x3a3d47, 0x08090e, 0.42, 0.87);
  const steelHi    = matSteel(0x5c606e, 0x0e0f16, 0.28, 0.92);
  const olive      = matOlive(0x3a3e28, 0x060700);
  const oliveHi    = matOlive(0x505438, 0x080900);
  const black      = matSteel(0x0d0d0f, 0x000000, 0.60, 0.70);
  const yellow     = matSteel(0x9a7a10, 0x1a1200, 0.38, 0.60);

  // Slide group (bolt carrier — moves for recoil)
  const slideGroup = new THREE.Group();
  group.add(slideGroup);

  // Upper receiver / bolt carrier
  box(0.14, 0.1, 0.36, steelMid, 0, 0.02, -0.04, slideGroup);
  box(0.142, 0.006, 0.36, steelHi, 0, 0.072, -0.04, slideGroup); // top rail
  // Charging handle
  box(0.015, 0.022, 0.04, steelHi, 0.073, 0.03, 0.05, slideGroup);
  // Ejection port
  box(0.004, 0.044, 0.07, black, 0.072, 0.02, -0.01, slideGroup);
  // Bolt face detail
  box(0.015, 0.048, 0.008, steelDark, 0.064, 0.016, -0.04, slideGroup);

  slideGroup.userData.baseZ = 0;
  const slide = slideGroup;

  // Lower receiver
  box(0.14, 0.072, 0.3, olive, 0, -0.052, -0.02);
  box(0.142, 0.006, 0.3, oliveHi, 0, -0.016, -0.02);

  // Barrel — long and heavy
  box(0.062, 0.062, 0.52, steelDark, 0, 0.018, -0.34);
  // Barrel fluting rings
  for (let i = 0; i < 6; i++) {
    box(0.066, 0.066, 0.01, steelHi, 0, 0.018, -0.12 - i * 0.052);
  }
  // Muzzle device (flash hider)
  box(0.058, 0.058, 0.06, steelMid, 0, 0.018, -0.63);
  box(0.04, 0.04, 0.065, black, 0, 0.018, -0.634);
  // Flash hider slots
  box(0.062, 0.018, 0.062, black, 0, 0.032, -0.63);
  box(0.062, 0.018, 0.062, black, 0, 0.004, -0.63);

  // Heat shield over barrel
  box(0.08, 0.025, 0.32, steelDark, 0, 0.056, -0.24);
  for (let i = 0; i < 8; i++) {
    box(0.082, 0.004, 0.006, steelHi, 0, 0.07, -0.1 - i * 0.036);
  }

  // Magazine (box mag, prominent)
  const mag = box(0.1, 0.2, 0.08, steelDark, 0, -0.16, 0.02);
  const magBaseY = mag.position.y;
  box(0.102, 0.012, 0.084, black, 0, -0.262, 0.02); // base plate
  // Mag ribs
  for (let i = 0; i < 3; i++) {
    box(0.104, 0.006, 0.084, steelHi, 0, -0.08 - i * 0.056, 0.02);
  }
  // Round count window
  box(0.012, 0.06, 0.008, yellow, 0.053, -0.16, 0.024);

  // Pistol grip
  const grip = box(0.1, 0.22, 0.11, olive, 0, -0.175, 0.165);
  grip.rotation.x = 0.22;
  // Grip stippling strips
  for (let i = 0; i < 3; i++) {
    const s = box(0.103, 0.048, 0.005, oliveHi, 0, -0.12 - i * 0.055, 0.228);
    s.rotation.x = 0.22;
  }

  // Trigger guard
  box(0.14, 0.01, 0.09, olive, 0, -0.085, 0.075);
  box(0.14, 0.044, 0.01, olive, 0, -0.063, 0.032);
  // Trigger
  box(0.013, 0.036, 0.008, black, 0, -0.076, 0.055);

  // Muzzle flash at end of flash hider
  const muzzle = makeMuzzle(group);
  muzzle.position.set(0, 0.018, -0.68);

  group.traverse(o => { o.renderOrder = 5; });
  return { group, mag, muzzle, magBaseY, slide };
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function buildWeaponModel(type) {
  switch (type) {
    case 'pistol':  return buildPistol();
    case 'shotgun': return buildShotgun();
    case 'mg':      return buildMachinegun();
    default:        return buildPistol();
  }
}
