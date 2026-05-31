import * as THREE from 'three';

// ------------------------------------------------------------------
// CombatFX — tracers, hit markers, screen shake, damage direction,
//            floating damage numbers
// ------------------------------------------------------------------

const _v3 = new THREE.Vector3();
const _ndc = new THREE.Vector3();

function css(el, props) {
  for (const [k, v] of Object.entries(props)) el.style[k] = v;
}

function mkEl(tag, id, styles) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  css(el, {
    position: 'fixed', pointerEvents: 'none', zIndex: '999',
    ...styles,
  });
  return el;
}

// Simple seeded-ish LCG so shake offsets are smooth-ish without extra libs
let _seed = 1;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return (_seed >>> 0) / 0xffffffff - 0.5; // -0.5..0.5
}

// ------------------------------------------------------------------
export class CombatFX {
  constructor(scene) {
    this.scene = scene;
    this.trauma = 0;          // 0..1+
    this._tracers = [];       // { mesh, life }
    this._dmgNums = [];       // { pos:Vector3, el, life }
    this._hitTimer = 0;
    this._dmgDirTimer = 0;

    // Inject DOM elements
    const root = document.getElementById('app') || document.body;

    // Hit-marker: 4-line crosshair
    this._hitEl = mkEl('div', 'hitmarker', {
      left: '50%', top: '50%',
      transform: 'translate(-50%,-50%)',
      width: '20px', height: '20px',
      opacity: '0',
    });
    // The 4 line segments via box-shadow trick or simple child divs
    for (const [dx, dy, w, h] of [
      ['-9px', '-1px', '6px', '2px'],
      ['3px',  '-1px', '6px', '2px'],
      ['-1px', '-9px', '2px', '6px'],
      ['-1px', '3px',  '2px', '6px'],
    ]) {
      const seg = document.createElement('div');
      css(seg, {
        position: 'absolute', background: '#fff',
        left: dx, top: dy, width: w, height: h,
      });
      this._hitEl.appendChild(seg);
    }
    root.appendChild(this._hitEl);

    // Damage direction ring segment
    this._dmgDirEl = mkEl('div', 'dmgdir', {
      left: '50%', top: '50%',
      width: '80px', height: '80px',
      marginLeft: '-40px', marginTop: '-40px',
      borderRadius: '50%',
      border: '3px solid transparent',
      borderTopColor: '#ff2222',
      opacity: '0',
      transformOrigin: '50% 50%',
    });
    root.appendChild(this._dmgDirEl);

    // Damage numbers container
    this._dmgNumsEl = mkEl('div', 'dmgnums', {
      left: '0', top: '0',
      width: '100%', height: '100%',
      overflow: 'hidden',
    });
    root.appendChild(this._dmgNumsEl);

    // Tracer material (shared, additive)
    this._tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  // ----------------------------------------------------------------
  tracer(from, to) {
    // Thin box aligned along from->to
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length();
    if (length < 0.01) return;

    const geo = new THREE.CylinderGeometry(0.012, 0.012, length, 3, 1);
    const mesh = new THREE.Mesh(geo, this._tracerMat.clone());

    // Position at midpoint, orient toward 'to'
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );

    this.scene.add(mesh);
    this._tracers.push({ mesh, life: 0.05 });
  }

  // ----------------------------------------------------------------
  hitMarker(kill = false) {
    this._hitTimer = kill ? 0.22 : 0.12;
    const color = kill ? '#ff4422' : '#ffffff';
    const size = kill ? '28px' : '20px';
    css(this._hitEl, {
      opacity: '1',
      width: size, height: size,
    });
    for (const seg of this._hitEl.children) {
      seg.style.background = color;
    }
  }

  // ----------------------------------------------------------------
  shake(amount) {
    this.trauma = Math.min(2, this.trauma + amount);
  }

  // ----------------------------------------------------------------
  damageDir(angleRad) {
    // angleRad: world angle from player toward damage source
    // Rotate the arc so it points at the source (top of ring = front)
    css(this._dmgDirEl, {
      opacity: '0.85',
      transform: `rotate(${angleRad}rad)`,
    });
    this._dmgDirTimer = 0.7;
  }

  // ----------------------------------------------------------------
  damageNumber(pos, n) {
    const el = mkEl('div', null, {
      left: '-9999px', top: '-9999px',
      color: '#ffcc00',
      fontSize: '15px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      textShadow: '0 0 4px #000, 0 0 2px #000',
      userSelect: 'none',
      transition: 'none',
    });
    el.textContent = String(Math.round(n));
    this._dmgNumsEl.appendChild(el);
    this._dmgNums.push({ pos: pos.clone(), el, life: 1.2, rise: 0 });
  }

  // ----------------------------------------------------------------
  getShakeOffset() {
    if (this.trauma <= 0) return { x: 0, y: 0 };
    const t2 = this.trauma * this.trauma;
    const cap = 0.08;
    // Use two calls to rand for x/y; they change each frame for jitter
    const x = rand() * cap * t2;
    const y = rand() * cap * t2;
    return { x, y };
  }

  // ----------------------------------------------------------------
  update(dt, camera) {
    // --- trauma decay ---
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - dt * 1.8);

    // --- tracers ---
    for (let i = this._tracers.length - 1; i >= 0; i--) {
      const tr = this._tracers[i];
      tr.life -= dt;
      tr.mesh.material.opacity = Math.max(0, tr.life / 0.05);
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this._tracers.splice(i, 1);
      }
    }

    // --- hit marker fade ---
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      const a = Math.max(0, this._hitTimer / 0.22);
      this._hitEl.style.opacity = String(a);
    }

    // --- damage direction fade ---
    if (this._dmgDirTimer > 0) {
      this._dmgDirTimer -= dt;
      const a = Math.max(0, this._dmgDirTimer / 0.7) * 0.85;
      this._dmgDirEl.style.opacity = String(a);
    }

    // --- damage numbers: project + rise + fade ---
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = this._dmgNums.length - 1; i >= 0; i--) {
      const dn = this._dmgNums[i];
      dn.life -= dt;
      dn.rise += dt * 40; // px/s upward drift

      if (dn.life <= 0) {
        dn.el.remove();
        this._dmgNums.splice(i, 1);
        continue;
      }

      // Project world pos to screen
      _v3.copy(dn.pos);
      _v3.project(camera);          // NDC -1..1

      // Behind camera — hide
      if (_v3.z > 1) { dn.el.style.left = '-9999px'; continue; }

      const sx = (_v3.x * 0.5 + 0.5) * W;
      const sy = (-_v3.y * 0.5 + 0.5) * H - dn.rise;
      const alpha = Math.min(1, dn.life / 0.4);

      css(dn.el, {
        left: `${Math.round(sx)}px`,
        top:  `${Math.round(sy)}px`,
        opacity: String(alpha),
        transform: 'translate(-50%,-50%)',
      });
    }
  }

  // ----------------------------------------------------------------
  reset() {
    // Remove tracer meshes
    for (const tr of this._tracers) {
      this.scene.remove(tr.mesh);
      tr.mesh.geometry.dispose();
      tr.mesh.material.dispose();
    }
    this._tracers.length = 0;

    // Remove damage number DOM nodes
    for (const dn of this._dmgNums) dn.el.remove();
    this._dmgNums.length = 0;

    this.trauma = 0;
    this._hitTimer = 0;
    this._dmgDirTimer = 0;
    this._hitEl.style.opacity = '0';
    this._dmgDirEl.style.opacity = '0';
  }
}
