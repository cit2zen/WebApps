import * as THREE from 'three';

const POOL_CAP = 120;
const FADE_DURATION = 12;   // seconds until fully transparent

// --- Texture factories ---

function makeHoleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2;

  // outer darkened ring
  const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
  grad.addColorStop(0,   'rgba(10,8,6,0.98)');
  grad.addColorStop(0.35,'rgba(25,18,12,0.92)');
  grad.addColorStop(0.55,'rgba(55,40,30,0.72)');
  grad.addColorStop(0.75,'rgba(80,60,45,0.35)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // tiny bright burnt-rim highlight arc
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, r * 0.18, 0, Math.PI * 0.7);
  ctx.strokeStyle = 'rgba(200,160,100,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSplatTexture(color) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  // parse hex color to rgb
  const r = (color >> 16) & 0xff;
  const g = (color >> 8)  & 0xff;
  const b =  color        & 0xff;
  const darkR = Math.round(r * 0.35), darkG = Math.round(g * 0.2), darkB = Math.round(b * 0.2);

  // irregular blob via multiple overlapping ellipses
  const seeded = (s) => ((Math.sin(s * 127.1) * 43758.5453) % 1 + 1) % 1;
  const blobs = 9;
  for (let i = 0; i < blobs; i++) {
    const angle = seeded(i * 2)     * Math.PI * 2;
    const dist  = seeded(i * 2 + 1) * 22;
    const bx    = cx + Math.cos(angle) * dist;
    const by    = cy + Math.sin(angle) * dist;
    const rx    = 14 + seeded(i * 3)     * 26;
    const ry    = 10 + seeded(i * 3 + 1) * 18;
    const rot   = seeded(i * 5) * Math.PI;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grad.addColorStop(0,   `rgba(${darkR},${darkG},${darkB},0.92)`);
    grad.addColorStop(0.6, `rgba(${darkR},${darkG},${darkB},0.65)`);
    grad.addColorStop(1,   `rgba(${darkR},${darkG},${darkB},0)`);
    ctx.fillStyle = grad;
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// splat cache (per-color; hole is now per-instance on DecalPool)
const _splatCache   = new Map();

function getSplatTexture(color) {
  if (!_splatCache.has(color)) _splatCache.set(color, makeSplatTexture(color));
  return _splatCache.get(color);
}

// --- Pool entry ---

class Decal {
  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.age = 0;
    this.life = FADE_DURATION;
    this.active = false;
  }
}

// --- DecalPool ---

export class DecalPool {
  constructor(scene) {
    this._scene = scene;
    this._pool  = [];
    this._head  = 0;   // ring-buffer pointer for recycling oldest
    this._holeTexture = makeHoleTexture(); // per-instance so dispose() can free it

    for (let i = 0; i < POOL_CAP; i++) {
      const d = new Decal();
      scene.add(d.mesh);
      this._pool.push(d);
    }

    this._up     = new THREE.Vector3(0, 1, 0);
    this._lookAt = new THREE.Vector3();
  }

  // ----- internal -----

  _next() {
    // find an inactive slot first
    for (let i = 0; i < POOL_CAP; i++) {
      const idx = (this._head + i) % POOL_CAP;
      if (!this._pool[idx].active) {
        this._head = (idx + 1) % POOL_CAP;
        return this._pool[idx];
      }
    }
    // all active — recycle the oldest (ring-buffer head)
    const d = this._pool[this._head];
    this._head = (this._head + 1) % POOL_CAP;
    return d;
  }

  // ----- public API -----

  addBulletHole(pos, normal) {
    const d = this._next();
    d.age  = 0;
    d.life = FADE_DURATION;
    d.active = true;

    d.mat.map = this._holeTexture;
    d.mat.opacity = 1;
    d.mat.needsUpdate = true;

    const s = 0.18 + Math.random() * 0.08;
    d.mesh.scale.setScalar(s);

    // place slightly in front of the surface
    d.mesh.position.set(
      pos.x + normal.x * 0.02,
      pos.y + normal.y * 0.02,
      pos.z + normal.z * 0.02
    );

    // orient plane to face along normal
    this._lookAt.set(
      pos.x + normal.x,
      pos.y + normal.y,
      pos.z + normal.z
    );
    d.mesh.lookAt(this._lookAt);

    // slight random roll so holes don't all align
    d.mesh.rotateZ(Math.random() * Math.PI * 2);
    d.mesh.visible = true;
  }

  addSplat(pos, color = 0x8b0000) {
    const d = this._next();
    d.age  = 0;
    d.life = FADE_DURATION;
    d.active = true;

    d.mat.map = getSplatTexture(color);
    d.mat.opacity = 1;
    d.mat.needsUpdate = true;

    const s = 0.55 + Math.random() * 0.4;
    d.mesh.scale.setScalar(s);

    // floor splat: lie flat just above y=0
    d.mesh.position.set(pos.x, 0.03, pos.z);
    d.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    d.mesh.visible = true;
  }

  update(dt) {
    for (const d of this._pool) {
      if (!d.active) continue;
      d.age += dt;
      const remaining = d.life - d.age;
      if (remaining <= 0) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      // fade starts at ~half-life
      const fadeStart = d.life * 0.5;
      if (remaining < fadeStart) {
        d.mat.opacity = remaining / fadeStart;
      }
    }
  }

  reset() {
    for (const d of this._pool) {
      d.active = false;
      d.mesh.visible = false;
    }
    this._head = 0;
  }

  dispose() {
    for (const d of this._pool) {
      this._scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mat.dispose();
    }
    this._pool.length = 0;
    this._holeTexture.dispose();
    for (const tex of _splatCache.values()) tex.dispose();
    _splatCache.clear();
  }
}
