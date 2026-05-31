import * as THREE from 'three';
import { buildImp, buildCaster, buildCharger } from './impmodel.js';
import { EnemyAI, hasLOS } from './ai.js';

const RADIUS = 0.5;
const KNOCKBACK_SPEED = 7.0;
const KNOCKBACK_DECAY = 0.15;

// Caster range preferences
const CASTER_PREFER_DIST = 8;  // ideal distance from player
const CASTER_RETREAT_DIST = 4; // retreat if closer than this
const CASTER_FIRE_CD = 1.5;    // seconds between shots

// Charger overrides
const CHARGER_SPEED_MULT = 1.7;
const CHARGER_LUNGE_SPEED = 11.0;

export class Enemy {
  constructor(scene, pos, params, fx, projectiles) {
    this.scene = scene;
    this._fx = fx ?? null;
    this._projectiles = projectiles ?? null;
    this.hp = params.hp;
    this.speed = params.speed;
    this.damage = params.damage;
    this.type = params.type ?? 'imp';
    this.dead = false;
    this.dying = 0;
    this.attackCd = 0;
    this.flash = 0;
    this.punch = 0;
    this.moveAmt = 0;
    this.phase = pos.x * 0.7 + pos.z * 0.3;

    // jaw animation state
    this.jawOpen = 0;

    // lunge animation state
    this._lungeT = 0;
    this._lungeDir = new THREE.Vector3();

    // knockback impulse {x, z, t}
    this._kb = { x: 0, z: 0, t: 0 };

    // last known player position for knockback direction
    this._lastPlayer = null;

    // caster projectile cooldown
    this._fireCd = Math.random() * CASTER_FIRE_CD; // stagger on spawn

    // charger roar cooldown
    this._roarCd = 2.0 + Math.random() * 2.0;

    // AI instance
    this.ai = new EnemyAI();

    // hitscan box (chest-centred, in world units)
    this.aimY = 1.15;
    this.hitW = 0.6;
    this.hitH = 1.05;

    // Build model by type
    let modelResult;
    if (this.type === 'caster') {
      modelResult = buildCaster(params.tint ?? 0xffffff);
      this.aimY = 1.30;
    } else if (this.type === 'charger') {
      modelResult = buildCharger(params.tint ?? 0xffffff);
      this.aimY = 1.20;
      this.hitW = 0.8;
      this.hitH = 1.2;
      // Apply charger speed
      this.speed = this.speed * CHARGER_SPEED_MULT;
    } else {
      modelResult = buildImp(params.tint ?? 0xffffff);
    }

    const { root, parts, skin, mats } = modelResult;
    root.position.set(pos.x, root.position.y, pos.z);
    this.root = root;
    this.parts = parts;
    this.skin = skin;
    this.mats = mats;
    scene.add(root);
  }

  _chestPos() {
    return this.root.position.clone().setY(this.root.position.y + this.aimY);
  }

  _casterUpdate(dt, t, playerPos, isWall, onHit, others) {
    const root = this.root;
    const dx = playerPos.x - root.position.x;
    const dz = playerPos.z - root.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const distSafe = dist > 0.01 ? dist : 0.01;

    const los = hasLOS(root.position.x, root.position.z, playerPos.x, playerPos.z, isWall);

    // Distance-keeping movement
    let mx = 0, mz = 0;
    if (dist < CASTER_RETREAT_DIST) {
      // Retreat away from player
      mx = -(dx / distSafe);
      mz = -(dz / distSafe);
    } else if (dist > CASTER_PREFER_DIST) {
      // Approach player
      mx = dx / distSafe;
      mz = dz / distSafe;
    } else {
      // Ideal range — strafe sideways
      const perpX = -dz / distSafe;
      const perpZ =  dx / distSafe;
      mx = perpX * 0.5;
      mz = perpZ * 0.5;
    }

    // Wall slide movement
    const step = this.speed * dt;
    const mvMag = Math.sqrt(mx * mx + mz * mz);
    let moving = false;
    if (mvMag > 0.01) {
      moving = true;
      const ndx = mx / mvMag;
      const ndz = mz / mvMag;
      const nx = root.position.x + ndx * step;
      const nz = root.position.z + ndz * step;
      if (!isWall(nx + Math.sign(ndx) * RADIUS, root.position.z)) root.position.x = nx;
      if (!isWall(root.position.x, nz + Math.sign(ndz) * RADIUS)) root.position.z = nz;
    }

    // Apply knockback
    if (this._kb.t > 0) {
      this._kb.t = Math.max(0, this._kb.t - dt);
      if (this._kb.t === 0) { this._kb.x = 0; this._kb.z = 0; }
      const ratio = this._kb.t / KNOCKBACK_DECAY;
      const kbStep = KNOCKBACK_SPEED * ratio * dt;
      const knx = root.position.x + this._kb.x * kbStep;
      const knz = root.position.z + this._kb.z * kbStep;
      if (!isWall(knx + Math.sign(this._kb.x) * RADIUS, root.position.z)) root.position.x = knx;
      if (!isWall(root.position.x, knz + Math.sign(this._kb.z) * RADIUS)) root.position.z = knz;
    }

    // Face the player always
    root.rotation.y = Math.atan2(dx, dz);

    // Projectile fire
    this._fireCd -= dt;
    if (los && dist > 2 && this._fireCd <= 0 && this._projectiles) {
      this._fireCd = CASTER_FIRE_CD + (Math.random() - 0.5) * 0.4;
      const chest = this._chestPos();
      const dir = new THREE.Vector3(dx / distSafe, 0, dz / distSafe);
      // Slight vertical aim toward player eye height (~1.6)
      const eyeDY = 1.6 - chest.y;
      dir.y = eyeDY / distSafe;
      dir.normalize();
      this._projectiles.spawn(chest, dir, { damage: this.damage });
      this._fx?.audio?.casterCast?.();
      // jaw snap on fire
      this.jawOpen = 0.45;
    }

    // Caster float bob animation
    const baseY = 0.18;
    root.position.y = baseY + Math.sin(t * 1.8 + this.phase) * 0.08;

    // Arm sway (spellcasting)
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 6);
    const sway = Math.sin(t * 3 + this.phase) * 0.25;
    if (this.parts.armL) this.parts.armL.rotation.x = -0.3 + sway * 0.3;
    if (this.parts.armR) this.parts.armR.rotation.x = -0.3 - sway * 0.3;

    // jaw close
    if (this.jawOpen > 0) {
      this.jawOpen = Math.max(0, this.jawOpen - dt * 4);
      if (this.parts.jaw) this.parts.jaw.rotation.x = this.jawOpen;
    }

    // punch scale
    const punchK = this.punch > 0 ? (this.punch -= dt, 1.08) : 1;
    root.scale.setScalar(0.82 * punchK);

    // hit flash
    if (this.flash > 0) { this.flash -= dt; this.skin.emissive.setRGB(0.6, 0.1, 0.8); }
    else this.skin.emissive.setRGB(0, 0, 0);
  }

  _chargerUpdate(dt, t, playerPos, isWall, onHit, others) {
    const root = this.root;

    this._lastPlayer = { x: playerPos.x, z: playerPos.z };

    const self = { x: root.position.x, z: root.position.z, speed: this.speed };
    const { move, attack, face } = this.ai.decide(self, playerPos, isWall, others, dt, this);

    // Movement
    let moving = false;
    const mvMag = Math.sqrt(move.x * move.x + move.z * move.z);
    if (mvMag > 0.01) {
      moving = true;
      const step = this.speed * dt;
      const ndx = move.x / mvMag;
      const ndz = move.z / mvMag;
      const nx = root.position.x + ndx * step;
      const nz = root.position.z + ndz * step;
      if (!isWall(nx + Math.sign(ndx) * RADIUS, root.position.z)) root.position.x = nx;
      if (!isWall(root.position.x, nz + Math.sign(ndz) * RADIUS)) root.position.z = nz;
    }

    // Knockback
    if (this._kb.t > 0) {
      this._kb.t = Math.max(0, this._kb.t - dt);
      if (this._kb.t === 0) { this._kb.x = 0; this._kb.z = 0; }
      const ratio = this._kb.t / KNOCKBACK_DECAY;
      const kbStep = KNOCKBACK_SPEED * ratio * dt;
      const knx = root.position.x + this._kb.x * kbStep;
      const knz = root.position.z + this._kb.z * kbStep;
      if (!isWall(knx + Math.sign(this._kb.x) * RADIUS, root.position.z)) root.position.x = knx;
      if (!isWall(root.position.x, knz + Math.sign(this._kb.z) * RADIUS)) root.position.z = knz;
    }

    root.rotation.y = Math.atan2(face.x, face.z);

    // Occasional roar (rate-limited)
    this._roarCd -= dt;
    if (this._roarCd <= 0) {
      this._roarCd = 3.0 + Math.random() * 3.0;
      this._fx?.audio?.roar?.();
    }

    // Contact attack — charger deals more damage and has stronger lunge
    if (attack) {
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = 0.75; // faster attack cadence
        onHit(this.damage);
        this.punch = 0.22;
        this.jawOpen = 0.65;

        const dx = playerPos.x - root.position.x;
        const dz = playerPos.z - root.position.z;
        this._lungeDir.set(dx, 0, dz).normalize();
        this._lungeT = 0.28; // slightly longer lunge
      }
    }

    // Jaw
    if (this.jawOpen > 0) {
      this.jawOpen = Math.max(0, this.jawOpen - dt * 3);
      if (this.parts.jaw) this.parts.jaw.rotation.x = this.jawOpen;
    }

    // Lunge (charger uses higher speed)
    if (this._lungeT > 0) {
      this._lungeT = Math.max(0, this._lungeT - dt);
      const k = Math.sin((1 - this._lungeT / 0.28) * Math.PI);
      const lx = this._lungeDir.x * k * CHARGER_LUNGE_SPEED * dt;
      const lz = this._lungeDir.z * k * CHARGER_LUNGE_SPEED * dt;
      if (!isWall(root.position.x + lx + Math.sign(lx) * RADIUS, root.position.z)) root.position.x += lx;
      if (!isWall(root.position.x, root.position.z + lz + Math.sign(lz) * RADIUS)) root.position.z += lz;
    }

    // Animation — heavier, slower cadence
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 7);
    const swing = Math.sin(t * 6 + this.phase) * 0.55 * this.moveAmt;
    if (this.parts.legL) this.parts.legL.rotation.x =  swing;
    if (this.parts.legR) this.parts.legR.rotation.x = -swing;
    if (this.parts.armL) this.parts.armL.rotation.x = -swing * 0.7;
    if (this.parts.armR) this.parts.armR.rotation.x =  swing * 0.7;

    const punchK = this.punch > 0 ? (this.punch -= dt, 1.12) : 1;
    root.scale.setScalar(1.05 * punchK);
    root.position.y = Math.abs(swing) * 0.12; // heavy footfall bob

    // hit flash — red tint
    if (this.flash > 0) { this.flash -= dt; this.skin.emissive.setRGB(0.9, 0.1, 0.0); }
    else this.skin.emissive.setRGB(0, 0, 0);
  }

  update(dt, t, playerPos, isWall, onHit, others = []) {
    const root = this.root;

    if (this.dying > 0) {
      this.dying -= dt;
      const k = Math.max(0, this.dying / 0.5);
      root.rotation.x = (1 - k) * 1.5;
      root.position.y = root.position.y - (1 - k) * 0.3 * dt / 0.5;
      for (const m of this.mats) m.opacity = k;
      if (this.dying <= 0) { this.scene.remove(root); this.mats.forEach((m) => m.dispose()); }
      return;
    }
    if (this.dead) return;

    this._lastPlayer = { x: playerPos.x, z: playerPos.z };

    if (this.type === 'caster') {
      this._casterUpdate(dt, t, playerPos, isWall, onHit, others);
      return;
    }

    if (this.type === 'charger') {
      this._chargerUpdate(dt, t, playerPos, isWall, onHit, others);
      return;
    }

    // --- IMP (original melee logic) ---
    const self = { x: root.position.x, z: root.position.z, speed: this.speed };
    const { move, attack, face } = this.ai.decide(self, playerPos, isWall, others, dt, this);

    let moving = false;
    const mvMag = Math.sqrt(move.x * move.x + move.z * move.z);
    if (mvMag > 0.01) {
      moving = true;
      const step = this.speed * dt;
      const ndx = move.x / mvMag;
      const ndz = move.z / mvMag;
      const nx = root.position.x + ndx * step;
      const nz = root.position.z + ndz * step;
      if (!isWall(nx + Math.sign(ndx) * RADIUS, root.position.z)) root.position.x = nx;
      if (!isWall(root.position.x, nz + Math.sign(ndz) * RADIUS)) root.position.z = nz;
    }

    if (this._kb.t > 0) {
      this._kb.t = Math.max(0, this._kb.t - dt);
      if (this._kb.t === 0) { this._kb.x = 0; this._kb.z = 0; }
      const ratio = this._kb.t / KNOCKBACK_DECAY;
      const kbStep = KNOCKBACK_SPEED * ratio * dt;
      const kbX = this._kb.x;
      const kbZ = this._kb.z;
      const knx = root.position.x + kbX * kbStep;
      const knz = root.position.z + kbZ * kbStep;
      if (!isWall(knx + Math.sign(kbX) * RADIUS, root.position.z)) root.position.x = knx;
      if (!isWall(root.position.x, knz + Math.sign(kbZ) * RADIUS)) root.position.z = knz;
    }

    root.rotation.y = Math.atan2(face.x, face.z);

    if (attack) {
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = 1.0;
        onHit(this.damage);
        this.punch = 0.18;
        this.jawOpen = 0.55;

        const dx = playerPos.x - root.position.x;
        const dz = playerPos.z - root.position.z;
        this._lungeDir.set(dx, 0, dz).normalize();
        this._lungeT = 0.25;
      }
    }

    if (this.jawOpen > 0) {
      this.jawOpen = Math.max(0, this.jawOpen - dt * 3);
      if (this.parts.jaw) this.parts.jaw.rotation.x = this.jawOpen;
    }

    if (this._lungeT > 0) {
      this._lungeT = Math.max(0, this._lungeT - dt);
      const k = Math.sin((1 - this._lungeT / 0.25) * Math.PI);
      const LUNGE_SPEED = 7.2;
      const lx = this._lungeDir.x * k * LUNGE_SPEED * dt;
      const lz = this._lungeDir.z * k * LUNGE_SPEED * dt;
      if (!isWall(root.position.x + lx + Math.sign(lx) * RADIUS, root.position.z)) root.position.x += lx;
      if (!isWall(root.position.x, root.position.z + lz + Math.sign(lz) * RADIUS)) root.position.z += lz;
    }

    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 8);
    const swing = Math.sin(t * 8 + this.phase) * 0.6 * this.moveAmt;
    this.parts.legL.rotation.x =  swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing;
    this.parts.armR.rotation.x =  swing;
    const punchK = this.punch > 0 ? (this.punch -= dt, 1.1) : 1;
    root.scale.setScalar(0.82 * punchK);
    root.position.y = Math.sin(t * 2 + this.phase) * 0.05 + Math.abs(swing) * 0.1;

    if (this.flash > 0) { this.flash -= dt; this.skin.emissive.setRGB(0.85, 0.1, 0.05); }
    else this.skin.emissive.setRGB(0, 0, 0);
  }

  takeDamage(n) {
    if (this.dead) return;
    this.hp -= n;
    this.flash = 0.12;
    this.punch = 0.14;

    if (this._lastPlayer) {
      const kbDx = this.root.position.x - this._lastPlayer.x;
      const kbDz = this.root.position.z - this._lastPlayer.z;
      const kbMag = Math.sqrt(kbDx * kbDx + kbDz * kbDz);
      if (kbMag > 0) {
        this._kb.x = kbDx / kbMag;
        this._kb.z = kbDz / kbMag;
      } else {
        this._kb.x = 1;
        this._kb.z = 0;
      }
      this._kb.t = KNOCKBACK_DECAY;
    }

    if (this._fx?.particles) {
      this._fx.particles.spawnBlood(this._chestPos(), new THREE.Vector3(0, 1, 0), 12);
    }
    if (this.hp <= 0) this.kill();
  }

  kill() {
    if (this.dead) return;
    if (this._fx?.particles) {
      const tint = this.mats[0]?.color?.getHex?.() ?? 0x884422;
      this._fx.particles.spawnGib(this._chestPos(), tint, 24);
    }
    if (this._fx?.decals) {
      this._fx.decals.addSplat(this.root.position.clone(), 0x550000);
    }
    this.dead = true;
    this.dying = 0.5;
  }

  dispose() {
    this.dead = true;
    this.scene.remove(this.root);
    this.mats.forEach((m) => m.dispose());
  }
}
