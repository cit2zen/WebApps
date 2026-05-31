import * as THREE from 'three';

const CAP = 600;

function makePointTexture() {
  const sz = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = sz;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.35,'rgba(255,255,255,0.9)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.3)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

function mkParticle() {
  return {
    active: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    size: 1,
    r: 1, g: 1, b: 1,
    gravity: true,
  };
}

export class ParticleSystem {
  constructor(scene) {
    this._scene = scene;
    this._cap = CAP;

    // JS pool
    this._pool = [];
    for (let i = 0; i < CAP; i++) this._pool.push(mkParticle());
    this._cursor = 0; // next slot to recycle

    // GPU buffers
    this._positions = new Float32Array(CAP * 3);
    this._colors    = new Float32Array(CAP * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(this._colors,    3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      size: 0.18,
      sizeAttenuation: true,
      vertexColors: true,
      map: makePointTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    this._points = new THREE.Points(geo, mat);
    this._points.frustumCulled = false;
    scene.add(this._points);

    this._geo = geo;
    this._activeCount = 0;
  }

  // ---- private helpers ----

  _alloc() {
    // find first inactive
    for (let i = 0; i < CAP; i++) {
      const idx = (this._cursor + i) % CAP;
      if (!this._pool[idx].active) {
        this._cursor = (idx + 1) % CAP;
        return this._pool[idx];
      }
    }
    // full: recycle oldest (cursor)
    const p = this._pool[this._cursor];
    this._cursor = (this._cursor + 1) % CAP;
    return p;
  }

  _spawn(pos, vel, r, g, b, life, size, gravity = true) {
    const p = this._alloc();
    p.active  = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.r = r; p.g = g; p.b = b;
    p.life    = life;
    p.maxLife = life;
    p.size    = size;
    p.gravity = gravity;
  }

  _rand(a, b) { return a + Math.random() * (b - a); }

  // ---- public spawn methods ----

  spawnSparks(pos, dir, color, n = 10) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const spread = 0.9;
      const vel = new THREE.Vector3(
        dir.x + this._rand(-spread, spread),
        dir.y + this._rand(-spread, spread),
        dir.z + this._rand(-spread, spread)
      ).normalize().multiplyScalar(this._rand(2.5, 6.0));
      this._spawn(pos, vel, c.r, c.g, c.b, this._rand(0.25, 0.6), this._rand(0.08, 0.18));
    }
  }

  spawnImpact(pos, normal, n = 8) {
    for (let i = 0; i < n; i++) {
      const tangent = new THREE.Vector3(
        this._rand(-1, 1), this._rand(-1, 1), this._rand(-1, 1)
      );
      tangent.addScaledVector(normal, -tangent.dot(normal)).normalize();
      const vel = new THREE.Vector3()
        .addScaledVector(normal, this._rand(0.5, 2.5))
        .addScaledVector(tangent, this._rand(-1.5, 1.5));
      vel.y += this._rand(0.2, 1.0);
      const grey = this._rand(0.45, 0.7);
      this._spawn(pos, vel, grey, grey, grey, this._rand(0.3, 0.7), this._rand(0.06, 0.14));
    }
  }

  spawnBlood(pos, dir, n = 12) {
    for (let i = 0; i < n; i++) {
      const spread = 1.1;
      const vel = new THREE.Vector3(
        dir.x + this._rand(-spread, spread),
        dir.y + this._rand(-spread, spread),
        dir.z + this._rand(-spread, spread)
      ).normalize().multiplyScalar(this._rand(1.5, 4.5));
      // dark red
      this._spawn(pos, vel, this._rand(0.45, 0.65), 0.02, 0.02,
        this._rand(0.35, 0.65), this._rand(0.07, 0.16));
    }
  }

  spawnGib(pos, color, n = 24) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const vel = new THREE.Vector3(
        this._rand(-1, 1), this._rand(0.2, 1), this._rand(-1, 1)
      ).normalize().multiplyScalar(this._rand(2.0, 7.0));
      this._spawn(pos, vel, c.r * 0.9, c.g * 0.2, c.b * 0.2,
        this._rand(0.4, 0.9), this._rand(0.10, 0.22));
    }
  }

  emitEmbers(min, max, dt, rate = 20) {
    const count = Math.round(rate * dt);
    for (let i = 0; i < count; i++) {
      const pos = new THREE.Vector3(
        this._rand(min.x, max.x),
        this._rand(min.y, max.y),
        this._rand(min.z, max.z)
      );
      const vel = new THREE.Vector3(
        this._rand(-0.2, 0.2),
        this._rand(0.4, 1.2),
        this._rand(-0.2, 0.2)
      );
      // orange-yellow ember
      this._spawn(pos, vel, this._rand(0.9, 1.0), this._rand(0.3, 0.6), 0.0,
        this._rand(0.8, 2.0), this._rand(0.04, 0.10), false);
    }
  }

  // ---- update ----

  update(dt) {
    const GRAVITY = 9.0;
    let writeIdx = 0;

    for (let i = 0; i < CAP; i++) {
      const p = this._pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }

      if (p.gravity) p.vel.y -= GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);

      const frac = Math.max(0, p.life / p.maxLife); // 1->0 fade
      const bi = writeIdx * 3;
      this._positions[bi]     = p.pos.x;
      this._positions[bi + 1] = p.pos.y;
      this._positions[bi + 2] = p.pos.z;
      this._colors[bi]     = p.r * frac;
      this._colors[bi + 1] = p.g * frac;
      this._colors[bi + 2] = p.b * frac;
      writeIdx++;
    }

    this._activeCount = writeIdx;
    this._geo.setDrawRange(0, writeIdx);
    this._geo.attributes.position.needsUpdate = true;
    this._geo.attributes.color.needsUpdate    = true;
  }

  reset() {
    for (let i = 0; i < CAP; i++) this._pool[i].active = false;
    this._geo.setDrawRange(0, 0);
    this._cursor = 0;
  }

  dispose() {
    this._scene.remove(this._points);
    this._geo.dispose();
    this._points.material.map?.dispose();
    this._points.material.dispose();
  }
}
