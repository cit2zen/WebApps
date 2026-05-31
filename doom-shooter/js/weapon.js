import * as THREE from 'three';
import { WEAPONS, buildWeaponModel } from './weapons.js';

const WEAPON_TYPES = ['pistol', 'shotgun', 'mg'];
const BASE = { x: 0.2, y: -0.2, z: -0.5, ry: -0.08 };

// Per-type initial ammo loadout
const INITIAL_AMMO = {
  pistol:  { ammo: 12, reserve: 48 },
  shotgun: { ammo: 6,  reserve: 24 },
  mg:      { ammo: 30, reserve: 90 },
};

function blocked(a, b, isWall) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(dist);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true;
  }
  return false;
}

export class Weapon {
  constructor(scene, camera, audio, fx) {
    this.scene  = scene;
    this.camera = camera;
    this.audio  = audio;
    this.fx     = fx ?? null;

    // Per-weapon ammo banks
    this._banks = {};
    for (const type of WEAPON_TYPES) {
      this._banks[type] = { ...INITIAL_AMMO[type] };
    }

    // Current weapon state
    this.weaponType = 'pistol';
    this.WEAPONS    = WEAPONS;

    // Animation state
    this.reloading = 0;
    this.kick      = 0;
    this.flash     = 0;
    this.fovKick   = 0;
    this.bobPhase  = 0;
    this.moveAmt   = 0;
    this.baseFov   = camera.fov;
    this._fireCooldown = 0;

    // Build and attach current model
    this.group    = null;
    this.mag3d    = null;
    this.muzzle   = null;
    this.magBaseY = 0;
    this.slide    = null;
    this._attachModel('pistol');

    this.light = new THREE.PointLight(0xffb24d, 0, 10);
    this.light.position.set(0, -0.2, -1);
    camera.add(this.light);

    this._fwd    = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._right  = new THREE.Vector3();
    this._up     = new THREE.Vector3();
  }

  // ── accessors for HUD ──────────────────────────────────────────────────────
  get ammo()    { return this._banks[this.weaponType].ammo; }
  set ammo(v)   { this._banks[this.weaponType].ammo = v; }
  get reserve() { return this._banks[this.weaponType].reserve; }
  set reserve(v){ this._banks[this.weaponType].reserve = v; }
  get mag()        { return WEAPONS[this.weaponType].mag; }
  get reserveMax() { return WEAPONS[this.weaponType].reserveMax; }
  get name()       { return WEAPONS[this.weaponType].name; }

  /** Add ammo to active weapon's reserve (ammo pickup) */
  addAmmo() {
    const wep = WEAPONS[this.weaponType];
    const bank = this._banks[this.weaponType];
    const add = Math.round(wep.mag * 1.5);
    bank.reserve = Math.min(wep.reserveMax, bank.reserve + add);
  }

  // ── model swap ────────────────────────────────────────────────────────────
  _attachModel(type) {
    if (this.group) {
      this.camera.remove(this.group);
      this.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    }
    const { group, mag, muzzle, magBaseY, slide } = buildWeaponModel(type);
    this.group    = group;
    this.mag3d    = mag;
    this.muzzle   = muzzle;
    this.magBaseY = magBaseY;
    this.slide    = slide ?? null;
    group.position.set(BASE.x, BASE.y, BASE.z);
    group.rotation.y = BASE.ry;
    this.camera.add(group);
    this.weaponType = type;
  }

  switchTo(idx) {
    const type = WEAPON_TYPES[idx];
    if (!type || type === this.weaponType) return;
    this.reloading     = 0;
    this.kick          = 0;
    this.flash         = 0;
    this.fovKick       = 0;
    this._fireCooldown = 0;
    this._attachModel(type);
    (window.GAME?.audio || this.audio)?.weaponSwitch?.();
  }

  // ── hitscan for one ray direction ─────────────────────────────────────────
  _singleHitscan(o, dir, enemies, isWall, damage) {
    let best = null, bestT = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const p  = e.root.position;
      const rx = p.x - o.x, ry = p.y + e.aimY - o.y, rz = p.z - o.z;
      const t  = rx * dir.x + ry * dir.y + rz * dir.z;
      if (t <= 0 || t >= bestT) continue;
      const dx = rx - dir.x * t, dy = ry - dir.y * t, dz = rz - dir.z * t;
      if (Math.hypot(dx, dz) < e.hitW + 0.18 && Math.abs(dy) < e.hitH && !blocked(o, p, isWall)) {
        best = e; bestT = t;
      }
    }

    let endPoint;
    if (best) {
      best.takeDamage(damage);
      endPoint = best.root.position.clone().setY(best.root.position.y + best.aimY);
      return { hit: best, endPoint, t: bestT };
    }

    // ray-march to wall
    const MAX_DIST = 40, STEP = 0.5;
    let hitPos = null, hitNormal = null;
    for (let t = STEP; t < MAX_DIST; t += STEP) {
      const wx = o.x + dir.x * t, wz = o.z + dir.z * t;
      if (isWall(wx, wz)) {
        hitPos    = new THREE.Vector3(o.x + dir.x * (t - STEP), o.y + dir.y * (t - STEP), o.z + dir.z * (t - STEP));
        hitNormal = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
        break;
      }
    }
    endPoint = hitPos ?? new THREE.Vector3().copy(o).addScaledVector(dir, 30);
    return { hit: null, endPoint, hitPos, hitNormal };
  }

  // ── tryFire ───────────────────────────────────────────────────────────────
  tryFire(enemies, isWall) {
    if (this.reloading > 0)                      return null;
    if (this._fireCooldown > 0)                   return null;
    if (this.ammo <= 0) { this.audio?.empty(); this.reload(); return null; }

    const wep = WEAPONS[this.weaponType];
    this.ammo--;
    this._fireCooldown = wep.fireRate;
    this.kick          = 1;
    this.flash         = 0.06;
    this.fovKick       = 1;
    this.light.intensity = 4.5;
    this.muzzle.rotation.z = this.bobPhase * 13;
    this.muzzle.scale.setScalar(0.8 + (this.ammo % 3) * 0.18);
    const _aud = window.GAME?.audio || this.audio;
    if (_aud?.shotFor) _aud.shotFor(this.weaponType);
    else _aud?.shot?.();

    this.camera.getWorldDirection(this._fwd);
    this.camera.getWorldPosition(this._origin);
    // build right/up for spread
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

    const f = this._fwd, o = this._origin;
    const muzzleWorld = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzleWorld);

    if (this.fx?.particles) this.fx.particles.spawnSparks(muzzleWorld, f, 0xffcc44, 8);
    if (this.fx?.combat)    this.fx.combat.shake(0.3);

    const { pellets, spread, damage } = wep;
    let firstHit  = null;
    let firstEnd  = null;
    const hitSet  = new Set();

    for (let p = 0; p < pellets; p++) {
      let dir;
      if (spread > 0) {
        const angle = Math.random() * Math.PI * 2;
        const r     = Math.random() * spread;
        dir = new THREE.Vector3()
          .copy(f)
          .addScaledVector(this._right, Math.cos(angle) * r)
          .addScaledVector(this._up,    Math.sin(angle) * r)
          .normalize();
      } else {
        dir = f;
      }

      const result = this._singleHitscan(o, dir, enemies, isWall, damage);

      if (result.hit) {
        if (!hitSet.has(result.hit)) {
          hitSet.add(result.hit);
          if (!firstHit) firstHit = result.hit;
        }
        if (!firstEnd) firstEnd = result.endPoint;

        if (this.fx?.combat && p === 0) {
          this.fx.combat.hitMarker(result.hit.dead);
          this.fx.combat.damageNumber(result.endPoint.clone().setY(result.endPoint.y + 0.5), damage);
        }
        if (this.fx?.particles) {
          this.fx.particles.spawnBlood?.(result.endPoint, 4);
        }
      } else {
        if (!firstEnd) firstEnd = result.endPoint;
        if (result.hitPos && this.fx?.particles) {
          this.fx.particles.spawnImpact(result.hitPos, result.hitNormal, 8);
        }
        if (result.hitPos && this.fx?.decals) {
          this.fx.decals.addBulletHole(result.hitPos, result.hitNormal);
        }
      }

      // tracer: draw for first pellet and a representative spread sample
      if ((p === 0 || p === Math.floor(pellets / 2)) && this.fx?.combat) {
        this.fx.combat.tracer(muzzleWorld, result.endPoint);
      }
    }

    if (firstHit) {
      this.audio?.[firstHit.dead ? 'enemyDeath' : 'hit']();
    }

    return firstHit;
  }

  reload() {
    if (this.reloading > 0 || this.reserve <= 0 || this.ammo >= this.mag) return;
    this.reloading = 1.0;
    this.audio?.reload();
  }

  update(dt, moving = false) {
    // fire-rate cooldown
    if (this._fireCooldown > 0) this._fireCooldown = Math.max(0, this._fireCooldown - dt);

    // reload animation
    let rDipY = 0, rRotZ = 0, rRotX = 0, magY = 0;
    if (this.reloading > 0) {
      this.reloading -= dt;
      const p  = Math.min(1, 1 - this.reloading);
      const s  = Math.sin(p * Math.PI);
      rDipY = -s * 0.16; rRotZ = s * 0.7; rRotX = s * 0.35;
      const mp = Math.min(1, Math.max(0, (p - 0.2) / 0.6));
      magY = -Math.sin(mp * Math.PI) * 0.24;
      if (this.reloading <= 0) {
        const take = Math.min(this.mag - this.ammo, this.reserve);
        this.ammo   += take;
        this.reserve -= take;
        rDipY = rRotZ = rRotX = magY = 0;
      }
    }

    // recoil ease-out
    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 5);
    const recoilZ    = this.kick * 0.16;
    const recoilRotX = this.kick * 0.45;

    // slide
    if (this.slide) {
      this.slide.position.z = (this.slide.userData.baseZ ?? 0) + this.kick * 0.08;
    }

    // walk bob
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 8);
    if (moving) this.bobPhase += dt * 10;
    const bx = Math.sin(this.bobPhase) * 0.018 * this.moveAmt;
    const by = Math.abs(Math.sin(this.bobPhase)) * 0.014 * this.moveAmt;

    this.group.position.set(BASE.x + bx, BASE.y + by + rDipY, BASE.z + recoilZ);
    this.group.rotation.set(recoilRotX + rRotX, BASE.ry, rRotZ);
    this.mag3d.position.y = this.magBaseY + magY;

    // muzzle flash
    if (this.flash > 0) {
      this.flash -= dt;
      this.muzzle.visible = true;
      this.muzzle.material.opacity = Math.max(0, this.flash / 0.06);
    } else {
      this.muzzle.visible = false;
    }

    // fov punch
    if (this.fovKick > 0) {
      this.fovKick = Math.max(0, this.fovKick - dt * 6);
      this.camera.fov = this.baseFov + this.fovKick * 3.5;
      this.camera.updateProjectionMatrix();
    }

    if (this.light.intensity > 0) this.light.intensity = Math.max(0, this.light.intensity - dt * 16);
  }
}
