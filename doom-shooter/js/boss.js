import * as THREE from 'three';
import { hasLOS } from './ai.js';

// ─── constants ────────────────────────────────────────────────────────────────
const BOSS_RADIUS    = 0.9;
const MELEE_DIST     = 2.2;
const MELEE_CD       = 1.8;
const VOLLEY_CD      = 3.5;
const VOLLEY_MIN_CD  = 2.0;  // phase-2 fire rate boost
const VOLLEY_SHOTS   = 5;
const CHASE_SPEED    = 2.8;  // base; params.speed scales it
const LOS_STEP       = 0.6;
const KNOCKBACK_SPEED  = 5.0;
const KNOCKBACK_DECAY  = 0.18;
const DYING_TIME       = 1.8;

// phase-2 threshold (% hp)
const PHASE2_THRESHOLD = 0.4;

// ─── procedural model builder ─────────────────────────────────────────────────
function buildBossModel(tint) {
  const root = new THREE.Group();
  const mats = [];

  // helpers
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, transparent: true, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.28, ...opts });
    mats.push(m);
    return m;
  };
  const emissiveMat = (color, emissiveColor, emissiveIntensity = 1.5, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity,
      roughness: 0.4,
      metalness: 0.0,
      envMapIntensity: 0.28,
      transparent: true,
      ...opts
    });
    mats.push(m);
    return m;
  };
  const mk = (geo, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  // ── materials ──────────────────────────────────────────────────────────────
  // skin: rough organic surface, no metal
  const skinMat    = mat(tint ?? 0x8b1a1a, { roughness: 0.88, metalness: 0.0 });
  // armor: dark metal plates
  const armorMat   = mat(0x2a2a3e, { roughness: 0.45, metalness: 0.65 });
  // armor rim accents: slightly lighter, more metallic
  const armorRimMat= mat(0x4a3a6e, { roughness: 0.35, metalness: 0.75 });
  // bone spikes/horns/teeth
  const boneMat    = mat(0xc8a87a, { roughness: 0.75, metalness: 0.05 });
  // eyes: emissive red glow for bloom
  const eyeMatL    = emissiveMat(0xff2200, 0xff2200, 2.0);   // left eye
  const eyeMatR    = emissiveMat(0xff2200, 0xff2200, 2.0);   // right eye — separate so we can flash them
  // core orb: bright emissive orange for bloom, additive blending kept
  const coreMat    = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.0,
    envMapIntensity: 0.28,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mats.push(coreMat);
  // jaw: same as skin
  const jawMat     = mat(tint ?? 0x8b1a1a, { roughness: 0.88, metalness: 0.0 });
  // belly dark overlay
  const darkMat    = mat(0x120408, { roughness: 0.95, metalness: 0.0, opacity: 0.45 });

  // ── torso (wide barrel) ────────────────────────────────────────────────────
  const torsoGeo = new THREE.CylinderGeometry(0.82, 0.96, 1.6, 14);
  mk(torsoGeo, skinMat, 0, 1.6, 0);

  // dark belly shading
  const bellyGeo = new THREE.CylinderGeometry(0.80, 0.94, 1.6, 14);
  const belly = new THREE.Mesh(bellyGeo, darkMat);
  belly.position.set(0, 1.6, 0.06);
  belly.scale.set(1.01, 1.0, 0.55);
  root.add(belly);

  // glowing chest core orb
  const coreGeo = new THREE.SphereGeometry(0.28, 10, 10);
  const coreMesh = mk(coreGeo, coreMat, 0, 1.75, 0.82);

  // ── armored shoulder pads ─────────────────────────────────────────────────
  const shoulderGeo = new THREE.SphereGeometry(0.52, 12, 10);
  const shoulderL = mk(shoulderGeo, armorMat, -1.18, 2.15, 0);
  const shoulderR = mk(shoulderGeo, armorMat,  1.18, 2.15, 0);
  shoulderL.scale.set(1.0, 0.75, 0.85);
  shoulderR.scale.set(1.0, 0.75, 0.85);

  // shoulder rim accents
  const rimGeo = new THREE.TorusGeometry(0.46, 0.07, 8, 16);
  const rimL = new THREE.Mesh(rimGeo, armorRimMat);
  rimL.position.set(-1.18, 2.15, 0);
  rimL.rotation.y = Math.PI * 0.5;
  root.add(rimL);

  const rimR = new THREE.Mesh(rimGeo, armorRimMat);
  rimR.position.set(1.18, 2.15, 0);
  rimR.rotation.y = Math.PI * 0.5;
  root.add(rimR);

  // ── head ──────────────────────────────────────────────────────────────────
  const headGeo = new THREE.SphereGeometry(0.58, 14, 12);
  mk(headGeo, skinMat, 0, 2.84, 0);

  // heavy brow ridge
  const browGeo = new THREE.BoxGeometry(1.0, 0.18, 0.32);
  const brow = new THREE.Mesh(browGeo, armorMat);
  brow.position.set(0, 2.96, 0.38);
  brow.rotation.x = 0.28;
  root.add(brow);

  // eyes
  const eyeGeo = new THREE.SphereGeometry(0.115, 8, 8);
  const eyeL = mk(eyeGeo, eyeMatL, -0.20, 2.86, 0.50);
  const eyeR = mk(eyeGeo, eyeMatR,  0.20, 2.86, 0.50);

  // ── horns (pair of large, swept-back) ─────────────────────────────────────
  const hornGeo = new THREE.ConeGeometry(0.14, 0.7, 8);
  const hornL = new THREE.Mesh(hornGeo, boneMat);
  hornL.position.set(-0.38, 3.26, -0.08);
  hornL.rotation.z =  0.55;
  hornL.rotation.x = -0.25;
  root.add(hornL);

  const hornR = new THREE.Mesh(hornGeo, boneMat);
  hornR.position.set( 0.38, 3.26, -0.08);
  hornR.rotation.z = -0.55;
  hornR.rotation.x = -0.25;
  root.add(hornR);

  // inner horns (smaller, forward-facing)
  const hornSmGeo = new THREE.ConeGeometry(0.09, 0.42, 7);
  const iHornL = new THREE.Mesh(hornSmGeo, boneMat);
  iHornL.position.set(-0.20, 3.10, 0.22);
  iHornL.rotation.z =  0.30;
  iHornL.rotation.x =  0.20;
  root.add(iHornL);
  const iHornR = new THREE.Mesh(hornSmGeo, boneMat);
  iHornR.position.set( 0.20, 3.10, 0.22);
  iHornR.rotation.z = -0.30;
  iHornR.rotation.x =  0.20;
  root.add(iHornR);

  // ── jaw pivot ─────────────────────────────────────────────────────────────
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 2.52, 0.44);
  const jawGeo = new THREE.BoxGeometry(0.74, 0.18, 0.56);
  const jawMesh = new THREE.Mesh(jawGeo, jawMat);
  jawMesh.position.set(0, -0.09, 0.05);
  jawPivot.add(jawMesh);
  // teeth row
  const toothGeo = new THREE.ConeGeometry(0.055, 0.18, 5);
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(toothGeo, boneMat);
    tooth.position.set(i * 0.14, -0.03, 0.22);
    tooth.rotation.x = Math.PI;
    jawPivot.add(tooth);
  }
  root.add(jawPivot);

  // ── spine armor plates ────────────────────────────────────────────────────
  const plateGeo = new THREE.BoxGeometry(0.2, 0.3, 0.15);
  for (let i = 0; i < 4; i++) {
    const plate = new THREE.Mesh(plateGeo, armorMat);
    plate.position.set(0, 2.4 - i * 0.32, -0.88);
    plate.rotation.x = 0.22;
    root.add(plate);
  }

  // ── arms ──────────────────────────────────────────────────────────────────
  const upperArmGeo = new THREE.CylinderGeometry(0.24, 0.21, 1.1, 10);
  const foreArmGeo  = new THREE.CylinderGeometry(0.21, 0.25, 0.9, 10);
  const fistGeo     = new THREE.SphereGeometry(0.28, 10, 10);
  const spikeGeo    = new THREE.ConeGeometry(0.07, 0.32, 6);

  const mkArm = (side) => {  // side: -1 left, +1 right
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.18, 2.08, 0);

    const upper = new THREE.Mesh(upperArmGeo, skinMat);
    upper.position.y = -0.55;
    pivot.add(upper);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.y = -1.12;
    elbowPivot.rotation.x = 0.25;

    const fore = new THREE.Mesh(foreArmGeo, skinMat);
    fore.position.y = -0.45;
    elbowPivot.add(fore);

    // armored fist
    const fist = new THREE.Mesh(fistGeo, armorMat);
    fist.position.y = -0.96;
    elbowPivot.add(fist);

    // spikes on fist
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(spikeGeo, boneMat);
      const angle = (i / 3) * Math.PI * 2;
      spike.position.set(Math.sin(angle) * 0.20, -0.92, Math.cos(angle) * 0.20);
      spike.rotation.x = -Math.sin(angle) * 0.6;
      spike.rotation.z =  Math.cos(angle) * 0.6;
      elbowPivot.add(spike);
    }

    pivot.add(elbowPivot);
    root.add(pivot);
    return { pivot, elbowPivot };
  };

  const armL = mkArm(-1);
  const armR = mkArm( 1);

  // ── legs ──────────────────────────────────────────────────────────────────
  const thighGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.95, 10);
  const shinGeo  = new THREE.CylinderGeometry(0.24, 0.20, 0.82, 10);
  const footGeo  = new THREE.BoxGeometry(0.36, 0.18, 0.52);

  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 1.0, 0);

    const thigh = new THREE.Mesh(thighGeo, skinMat);
    thigh.position.y = -0.475;
    pivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.97;
    kneePivot.rotation.x = -0.22;

    const shin = new THREE.Mesh(shinGeo, skinMat);
    shin.position.y = -0.41;
    kneePivot.add(shin);

    const foot = new THREE.Mesh(footGeo, armorMat);
    foot.position.set(0, -0.87, 0.1);
    kneePivot.add(foot);

    pivot.add(kneePivot);
    root.add(pivot);
    return { pivot, kneePivot };
  };

  const legL = mkLeg(-1);
  const legR = mkLeg( 1);

  // base scale — large imposing presence
  root.scale.setScalar(1.0);

  // shadow casting for all meshes in the boss model
  root.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  return {
    root,
    parts: { armL, armR, legL, legR, jaw: jawPivot, coreMesh, eyeL, eyeR },
    skin: skinMat,
    eyeMatL,
    eyeMatR,
    mats,
  };
}

// ─── Boss class ───────────────────────────────────────────────────────────────
export class Boss {
  constructor(scene, pos, params, fx, projectiles) {
    this.scene       = scene;
    this._fx         = fx ?? null;
    this._projectiles = projectiles ?? null;

    this.isBoss  = true;
    this.type    = 'boss';
    this.maxHp   = params.hp ?? 600;
    this.hp      = this.maxHp;
    this.speed   = (params.speed ?? 2.0) * (CHASE_SPEED / 2.0);
    this.damage  = params.damage ?? 25;

    this.dead  = false;
    this.dying = 0;

    // hitscan duck-type
    this.aimY = 2.0;
    this.hitW = 1.6;
    this.hitH = 2.8;

    // combat timers
    this._meleeCd  = 0;
    this._volleyCd = VOLLEY_CD * 0.5 * Math.random(); // stagger first volley

    // animation helpers
    this._moveAmt    = 0;
    this._jawOpen    = 0;
    this._phase      = pos.x * 0.7 + pos.z * 0.3;
    this._flash      = 0;
    this._punchScale = 1;
    this._slamT      = 0;   // melee slam animation timer
    this._roarT      = 0;   // brief roar stretch

    // knockback
    this._kb = { x: 0, z: 0, t: 0 };
    this._lastPlayer = null;

    // AI state
    this._aiState  = 'idle';
    this._lastSeen = null;
    this._strafeTimer = 0;
    this._strafeDir   = 1;

    // build model
    const { root, parts, skin, eyeMatL, eyeMatR, mats } = buildBossModel(params.tint ?? 0x8b1a1a);
    root.position.set(pos.x, 0, pos.z);
    this.root     = root;
    this.parts    = parts;
    this.skin     = skin;
    this.eyeMatL  = eyeMatL;
    this.eyeMatR  = eyeMatR;
    this.mats     = mats;
    scene.add(root);
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  _chestPos() {
    return this.root.position.clone().setY(this.root.position.y + this.aimY);
  }

  _isPhase2() {
    return this.hp / this.maxHp <= PHASE2_THRESHOLD;
  }

  // ── update ───────────────────────────────────────────────────────────────
  update(dt, t, playerPos, isWall, onHit, others = []) {
    if (this.dying > 0) {
      this._tickDying(dt);
      return;
    }
    if (this.dead) return;

    this._lastPlayer = { x: playerPos.x, z: playerPos.z };

    const root = this.root;
    const dx   = playerPos.x - root.position.x;
    const dz   = playerPos.z - root.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const distSafe = dist > 0.01 ? dist : 0.01;

    const los = hasLOS(root.position.x, root.position.z, playerPos.x, playerPos.z, isWall, LOS_STEP);
    if (los) {
      this._aiState = 'chase';
      this._lastSeen = { x: playerPos.x, z: playerPos.z };
    }

    // ── movement ──────────────────────────────────────────────────────────
    const phase2 = this._isPhase2();
    const effectiveSpeed = this.speed * (phase2 ? 1.35 : 1.0);

    let mx = 0, mz = 0;
    if (this._aiState !== 'idle') {
      if (dist > MELEE_DIST + 0.4) {
        // chase with slight strafe
        this._strafeTimer -= dt;
        if (this._strafeTimer <= 0) {
          this._strafeTimer = 1.4;
          this._strafeDir = -this._strafeDir;
        }
        const fwdX = dx / distSafe, fwdZ = dz / distSafe;
        const perpX = -fwdZ * this._strafeDir;
        const perpZ =  fwdX * this._strafeDir;
        mx = fwdX + perpX * 0.25;
        mz = fwdZ + perpZ * 0.25;
      } else if (dist < MELEE_DIST - 0.8) {
        // back off slightly
        mx = -(dx / distSafe) * 0.4;
        mz = -(dz / distSafe) * 0.4;
      }
    }

    const mvMag = Math.sqrt(mx * mx + mz * mz);
    let moving = false;
    if (mvMag > 0.01) {
      moving = true;
      const step = effectiveSpeed * dt;
      const ndx = mx / mvMag, ndz = mz / mvMag;
      const nx = root.position.x + ndx * step;
      const nz = root.position.z + ndz * step;
      if (!isWall(nx + Math.sign(ndx) * BOSS_RADIUS, root.position.z)) root.position.x = nx;
      if (!isWall(root.position.x, nz + Math.sign(ndz) * BOSS_RADIUS)) root.position.z = nz;
    }

    // knockback
    if (this._kb.t > 0) {
      this._kb.t = Math.max(0, this._kb.t - dt);
      if (this._kb.t === 0) { this._kb.x = 0; this._kb.z = 0; }
      const ratio = this._kb.t / KNOCKBACK_DECAY;
      const kbStep = KNOCKBACK_SPEED * ratio * dt;
      const knx = root.position.x + this._kb.x * kbStep;
      const knz = root.position.z + this._kb.z * kbStep;
      if (!isWall(knx + Math.sign(this._kb.x) * BOSS_RADIUS, root.position.z)) root.position.x = knx;
      if (!isWall(root.position.x, knz + Math.sign(this._kb.z) * BOSS_RADIUS)) root.position.z = knz;
    }

    // face player
    root.rotation.y = Math.atan2(dx, dz);

    // ── melee slam ────────────────────────────────────────────────────────
    this._meleeCd -= dt;
    if (dist <= MELEE_DIST && los && this._meleeCd <= 0) {
      this._meleeCd = MELEE_CD;
      onHit(this.damage);
      this._slamT  = 0.32;
      this._jawOpen = 0.7;
      if (this._fx?.particles) {
        this._fx.particles.spawnSparks(this._chestPos(), new THREE.Vector3(0, 1, 0), 0xff3300, 18);
      }
    }

    // ── ranged volley ─────────────────────────────────────────────────────
    this._volleyCd -= dt;
    const volleyCooldown = phase2 ? VOLLEY_MIN_CD : VOLLEY_CD;
    if (los && dist > 3 && this._volleyCd <= 0 && this._projectiles) {
      this._volleyCd = volleyCooldown + Math.random() * 0.8;
      this._fireVolley(playerPos, distSafe, phase2);
      this._roarT = 0.25;
      this._jawOpen = 0.9;
    }

    // ── animation ─────────────────────────────────────────────────────────
    this._tickAnimation(dt, t, moving, phase2);
  }

  _fireVolley(playerPos, distSafe, phase2) {
    const chest  = this._chestPos();
    const shots  = phase2 ? VOLLEY_SHOTS + 2 : VOLLEY_SHOTS;
    const spread = phase2 ? 0.36 : 0.22;

    const dx = playerPos.x - this.root.position.x;
    const dz = playerPos.z - this.root.position.z;
    const baseDir = new THREE.Vector3(dx / distSafe, 0, dz / distSafe);
    const eyeDY   = 1.6 - chest.y;
    baseDir.y     = eyeDY / distSafe;
    baseDir.normalize();

    for (let i = 0; i < shots; i++) {
      const angle  = (i / (shots - 1) - 0.5) * spread * 2;
      const dir    = baseDir.clone();
      const cosA   = Math.cos(angle), sinA = Math.sin(angle);
      const newX   = dir.x * cosA - dir.z * sinA;
      const newZ   = dir.x * sinA + dir.z * cosA;
      dir.x = newX;
      dir.z = newZ;
      dir.normalize();
      const color  = phase2 ? 0xff2200 : 0xff6600;
      const speed  = phase2 ? 16 : 13;
      const damage = Math.round(this.damage * 0.55);
      this._projectiles.spawn(chest.clone(), dir, { speed, damage, color });
    }
  }

  _tickAnimation(dt, t, moving, phase2) {
    const parts = this.parts;

    // jaw
    if (this._jawOpen > 0) {
      this._jawOpen = Math.max(0, this._jawOpen - dt * 3.5);
      if (parts.jaw) parts.jaw.rotation.x = this._jawOpen;
    }

    // slam arm swing
    if (this._slamT > 0) {
      this._slamT = Math.max(0, this._slamT - dt);
      const k = Math.sin((1 - this._slamT / 0.32) * Math.PI);
      if (parts.armL) parts.armL.pivot.rotation.x = -k * 1.4;
      if (parts.armR) parts.armR.pivot.rotation.x = -k * 1.4;
    }

    // roar stretch
    if (this._roarT > 0) {
      this._roarT = Math.max(0, this._roarT - dt);
      const k = this._roarT / 0.25;
      this.root.scale.setScalar(1.0 + k * 0.07);
    }

    // walk cycle
    this._moveAmt += ((moving ? 1 : 0) - this._moveAmt) * Math.min(1, dt * 5);
    const swing = Math.sin(t * 5 + this._phase) * 0.55 * this._moveAmt;
    if (parts.legL && this._slamT <= 0) {
      parts.legL.pivot.rotation.x =  swing;
      parts.legR.pivot.rotation.x = -swing;
    }
    if (parts.armL && this._slamT <= 0) {
      parts.armL.pivot.rotation.x = -swing * 0.6;
      parts.armR.pivot.rotation.x =  swing * 0.6;
    }

    // heavy footfall bob
    this.root.position.y = Math.abs(swing) * 0.14;

    // core pulse (phase2: faster) — scale + emissiveIntensity for bloom
    const pulseRate = phase2 ? 6.0 : 3.5;
    const pulseAmt  = phase2 ? 0.38 : 0.22;
    if (parts.coreMesh) {
      const p = (Math.sin(t * pulseRate) * 0.5 + 0.5) * pulseAmt + (1 - pulseAmt);
      parts.coreMesh.scale.setScalar(p);
      const mat = parts.coreMesh.material;
      if (mat.isShaderMaterial === false && mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = phase2 ? 2.0 + p * 2.5 : 1.5 + p * 1.5;
      }
    }

    // eye glow (phase2: both eyes pulse bright via emissiveIntensity for bloom)
    if (phase2) {
      const eyeGlow = Math.sin(t * 8 + this._phase) * 0.5 + 0.5;
      const intensity = 1.5 + eyeGlow * 2.5;
      if (this.eyeMatL) this.eyeMatL.emissiveIntensity = intensity;
      if (this.eyeMatR) this.eyeMatR.emissiveIntensity = intensity;
    }

    // hit flash
    if (this._flash > 0) {
      this._flash -= dt;
      this.skin.emissive.setRGB(0.9, 0.1, 0.0);
    } else {
      this.skin.emissive.setRGB(0, 0, 0);
    }
  }

  _tickDying(dt) {
    this.dying -= dt;
    const k = Math.max(0, this.dying / DYING_TIME);

    // topple forward
    this.root.rotation.x = (1 - k) * 1.8;
    this.root.position.y = Math.max(-0.5, this.root.position.y - (1 - k) * 0.4 * dt / DYING_TIME);

    // scale down and fade
    const s = 1.0 * k + 0.01;
    this.root.scale.setScalar(s);
    for (const m of this.mats) m.opacity = k;

    if (this.dying <= 0) {
      this._disposed = true;
      this.scene.remove(this.root);
      this.mats.forEach((m) => m.dispose());
    }
  }

  // ── takeDamage ────────────────────────────────────────────────────────────
  takeDamage(n) {
    if (this.dead) return;
    this.hp -= n;
    this._flash = 0.14;

    if (this._lastPlayer) {
      const kbDx = this.root.position.x - this._lastPlayer.x;
      const kbDz = this.root.position.z - this._lastPlayer.z;
      const kbMag = Math.sqrt(kbDx * kbDx + kbDz * kbDz);
      if (kbMag > 0) {
        this._kb.x = kbDx / kbMag;
        this._kb.z = kbDz / kbMag;
      } else {
        this._kb.x = 1; this._kb.z = 0;
      }
      this._kb.t = KNOCKBACK_DECAY;
    }

    if (this._fx?.particles) {
      this._fx.particles.spawnBlood(this._chestPos(), new THREE.Vector3(0, 1, 0), 20);
    }

    if (this.hp <= 0) this.kill();
  }

  // ── kill ──────────────────────────────────────────────────────────────────
  kill() {
    if (this.dead) return;
    this.dead  = true;
    this.dying = DYING_TIME;

    // large gib burst
    if (this._fx?.particles) {
      const pos  = this._chestPos();
      const tint = this.skin?.color?.getHex?.() ?? 0x8b1a1a;
      this._fx.particles.spawnGib(pos, tint, 60);
      this._fx.particles.spawnSparks(pos, new THREE.Vector3(0, 1, 0), 0xff4400, 40);
    }
    if (this._fx?.decals) {
      this._fx.decals.addSplat(this.root.position.clone(), 0x550000);
    }
  }

  // ── dispose ───────────────────────────────────────────────────────────────
  dispose() {
    if (this._disposed) { this.dead = true; this.dying = 0; return; }
    this._disposed = true;
    this.dead = true;
    this.dying = 0;
    this.scene.remove(this.root);
    this.mats.forEach((m) => m.dispose());
  }
}
