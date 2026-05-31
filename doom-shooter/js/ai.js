// ai.js — decision logic only; movement executed by enemy.js

export function hasLOS(ax, az, bx, bz, isWall, step = 0.5) {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist === 0) return true;
  const steps = Math.ceil(dist / step);
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 1; i < steps; i++) {
    const cx = ax + sx * i;
    const cz = az + sz * i;
    if (isWall(cx, cz)) return false;
  }
  return true;
}

export function separation(self, others, radius = 1.4, selfRef = null) {
  let px = 0;
  let pz = 0;
  let count = 0;
  for (const other of others) {
    if (selfRef !== null && other === selfRef) continue;
    const ox = other.root ? other.root.position.x : other.x;
    const oz = other.root ? other.root.position.z : other.z;
    const dx = self.x - ox;
    const dz = self.z - oz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius && distSq > 0) {
      const dist = Math.sqrt(distSq);
      px += dx / dist;
      pz += dz / dist;
      count++;
    }
  }
  if (count === 0) return { x: 0, z: 0 };
  const mag = Math.sqrt(px * px + pz * pz);
  if (mag === 0) return { x: 0, z: 0 };
  return { x: px / mag, z: pz / mag };
}

export class EnemyAI {
  constructor() {
    this.state = 'idle';
    this.lastSeen = null;
    this._strafeTimer = 0;
    this._strafeDir = 1;
    this._wanderAccum = 0;
    this._wanderAngle = 0;
  }

  decide(self, player, isWall, others, dt, selfRef = null) {
    const dx = player.x - self.x;
    const dz = player.z - self.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const los = dist > 0 && hasLOS(self.x, self.z, player.x, player.z, isWall);

    if (los) {
      this.state = 'chase';
      this.lastSeen = { x: player.x, z: player.z };
    }

    if (this.state === 'idle') {
      return {
        move: { x: 0, z: 0 },
        attack: false,
        face: { x: dx, z: dz },
      };
    }

    // Attack range
    if (los && dist < 1.8) {
      const sep = separation(self, others, 1.4, selfRef);
      const mx = sep.x;
      const mz = sep.z;
      const mag = Math.sqrt(mx * mx + mz * mz);
      const move = mag > 1 ? { x: mx / mag, z: mz / mag } : { x: mx, z: mz };
      return {
        move,
        attack: true,
        face: dist > 0 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 1 },
      };
    }

    if (los) {
      // Chase with intermittent strafe
      this._strafeTimer -= dt;
      if (this._strafeTimer <= 0) {
        this._strafeTimer = 1.2;
        this._strafeDir = this._strafeDir === 1 ? -1 : 1;
      }

      const fwdX = dist > 0 ? dx / dist : 0;
      const fwdZ = dist > 0 ? dz / dist : 1;
      // perpendicular: rotate 90deg
      const perpX = -fwdZ * this._strafeDir;
      const perpZ = fwdX * this._strafeDir;

      const strafeWeight = 0.35;
      let mx = fwdX + perpX * strafeWeight;
      let mz = fwdZ + perpZ * strafeWeight;

      // Add separation
      const sep = separation(self, others, 1.4, selfRef);
      mx += sep.x * 0.5;
      mz += sep.z * 0.5;

      const mag = Math.sqrt(mx * mx + mz * mz);
      if (mag > 1) { mx /= mag; mz /= mag; }

      return {
        move: { x: mx, z: mz },
        attack: false,
        face: { x: fwdX, z: fwdZ },
      };
    }

    // No LOS — move toward lastSeen or wander
    if (this.lastSeen) {
      const lx = this.lastSeen.x - self.x;
      const lz = this.lastSeen.z - self.z;
      const ldist = Math.sqrt(lx * lx + lz * lz);

      if (ldist > 0.3) {
        const fx = lx / ldist;
        const fz = lz / ldist;
        const sep = separation(self, others, 1.4, selfRef);
        let mx = fx + sep.x * 0.5;
        let mz = fz + sep.z * 0.5;
        const mag = Math.sqrt(mx * mx + mz * mz);
        if (mag > 1) { mx /= mag; mz /= mag; }
        return {
          move: { x: mx, z: mz },
          attack: false,
          face: { x: fx, z: fz },
        };
      }

      // Arrived at lastSeen — wander
      this.state = 'wander';
      this.lastSeen = null;
      this._wanderAccum = 0;
    }

    // Wander: smooth direction derived from elapsed time accumulator
    this._wanderAccum += dt;
    // Slow sinusoidal angle change, no per-frame RNG
    this._wanderAngle += Math.sin(this._wanderAccum * 0.7) * dt * 1.1;
    const wx = Math.cos(this._wanderAngle);
    const wz = Math.sin(this._wanderAngle);
    const sep = separation(self, others, 1.4, selfRef);
    let mx = wx * 0.4 + sep.x * 0.5;
    let mz = wz * 0.4 + sep.z * 0.5;
    const mag = Math.sqrt(mx * mx + mz * mz);
    if (mag > 1) { mx /= mag; mz /= mag; }

    return {
      move: { x: mx, z: mz },
      attack: false,
      face: { x: wx, z: wz },
    };
  }
}
