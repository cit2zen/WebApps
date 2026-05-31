import * as THREE from 'three';

const POOL_SIZE = 64;
const HIT_RADIUS = 0.6;
const FLASH_LIFE = 0.08;

export class ProjectileSystem {
  constructor(scene) {
    this._scene = scene;
    this._pool = [];
    this._active = [];
    this._flashes = [];

    // shared geometry/material for all projectiles
    this._geo = new THREE.SphereGeometry(0.13, 6, 6);
    this._flashGeo = new THREE.SphereGeometry(0.35, 6, 6);

    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
      const mesh = new THREE.Mesh(this._geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this._pool.push({ mesh, mat, vel: new THREE.Vector3(), damage: 8, life: 0, alive: false });
    }
  }

  /** pos: THREE.Vector3, dir: THREE.Vector3 (unit), options: {speed,damage,color} */
  spawn(pos, dir, { speed = 12, damage = 8, color = 0xff4400 } = {}) {
    let proj = null;
    for (let i = 0; i < this._pool.length; i++) {
      if (!this._pool[i].alive) { proj = this._pool[i]; break; }
    }
    if (!proj) return; // pool exhausted

    proj.mat.color.setHex(color);
    proj.mesh.position.copy(pos);
    proj.vel.copy(dir).multiplyScalar(speed);
    proj.damage = damage;
    proj.life = 8.0; // max seconds before despawn
    proj.alive = true;
    proj.mesh.visible = true;
    this._active.push(proj);
  }

  /** dt: seconds, playerPos: THREE.Vector3, isWall: (x,z)->bool, onHitPlayer: (damage)->void */
  update(dt, playerPos, isWall, onHitPlayer) {
    const toRemove = [];

    for (let i = 0; i < this._active.length; i++) {
      const p = this._active[i];
      p.life -= dt;

      // move
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      const { x, z } = p.mesh.position;

      // wall collision
      if (isWall(x, z)) {
        this._spawnFlash(p.mesh.position, p.mat.color.getHex());
        toRemove.push(i);
        continue;
      }

      // out of life
      if (p.life <= 0) {
        toRemove.push(i);
        continue;
      }

      // player hit
      if (playerPos) {
        const dx = p.mesh.position.x - playerPos.x;
        const dy = p.mesh.position.y - playerPos.y;
        const dz = p.mesh.position.z - playerPos.z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 < HIT_RADIUS * HIT_RADIUS) {
          if (onHitPlayer) onHitPlayer(p.damage);
          this._spawnFlash(p.mesh.position, p.mat.color.getHex());
          toRemove.push(i);
          continue;
        }
      }
    }

    // remove in reverse so indices stay valid
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const p = this._active[idx];
      p.alive = false;
      p.mesh.visible = false;
      this._active.splice(idx, 1);
    }

    // update flashes
    for (let i = this._flashes.length - 1; i >= 0; i--) {
      const f = this._flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this._scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        this._flashes.splice(i, 1);
      } else {
        const t = f.life / FLASH_LIFE;
        f.mesh.scale.setScalar(1 + (1 - t) * 1.5);
        f.mesh.material.opacity = t;
      }
    }
  }

  _spawnFlash(pos, color) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this._flashGeo, mat);
    mesh.position.copy(pos);
    this._scene.add(mesh);
    this._flashes.push({ mesh, life: FLASH_LIFE });
  }

  reset() {
    for (const p of this._active) {
      p.alive = false;
      p.mesh.visible = false;
    }
    this._active.length = 0;

    for (const f of this._flashes) {
      this._scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
    }
    this._flashes.length = 0;
  }

  dispose() {
    this.reset();
    this._geo.dispose();
    this._flashGeo.dispose();
    for (const p of this._pool) {
      this._scene.remove(p.mesh);
      p.mat.dispose();
    }
    this._pool.length = 0;
  }
}
