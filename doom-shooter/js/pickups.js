import * as THREE from 'three';

const PICKUP_RADIUS = 1.0;
const BOB_SPEED = 2.0;
const BOB_AMP = 0.15;
const SPIN_SPEED = 1.8;
const BASE_Y = 0.5;

function buildHealthMesh() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x00dd44, emissive: 0x00aa22, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.1 });
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.18), mat);
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat);
  group.add(hBar, vBar);
  const glow = new THREE.PointLight(0x00ff44, 1.2, 2.5);
  group.add(glow);
  return group;
}

function buildAmmoMesh() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xddcc00, emissive: 0xaa8800, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.5), mat);
  group.add(box);
  // small bullets on top
  const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffee44, emissive: 0x886600, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.8 });
  for (let i = -1; i <= 1; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), bulletMat);
    b.position.set(i * 0.1, 0.22, 0);
    group.add(b);
  }
  const glow = new THREE.PointLight(0xffcc00, 1.0, 2.2);
  group.add(glow);
  return group;
}

export class PickupSystem {
  constructor(scene) {
    this._scene = scene;
    this._pickups = [];
    this._clock = 0;
  }

  spawn(type, pos) {
    const mesh = type === 'health' ? buildHealthMesh() : buildAmmoMesh();
    mesh.position.set(pos.x, BASE_Y, pos.z);
    this._scene.add(mesh);
    this._pickups.push({ type, mesh, phase: Math.random() * Math.PI * 2, collected: false });
  }

  update(dt, playerPos, onPickup) {
    this._clock += dt;
    for (const p of this._pickups) {
      if (p.collected) continue;
      const t = this._clock + p.phase;
      p.mesh.position.y = BASE_Y + Math.sin(t * BOB_SPEED) * BOB_AMP;
      p.mesh.rotation.y += SPIN_SPEED * dt;
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < PICKUP_RADIUS) {
        p.collected = true;
        this._scene.remove(p.mesh);
        onPickup(p.type);
      }
    }
  }

  reset() {
    for (const p of this._pickups) {
      this._scene.remove(p.mesh);
    }
    this._pickups = [];
    this._clock = 0;
  }

  dispose() {
    this.reset();
  }
}
