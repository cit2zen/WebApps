import * as THREE from 'three';

// Module-cached shared geometries
let G = null;
function geos() {
  if (G) return G;
  G = {
    head:    new THREE.SphereGeometry(0.5, 14, 12),
    torso:   new THREE.CylinderGeometry(0.38, 0.58, 1.1, 12),
    belly:   new THREE.CylinderGeometry(0.36, 0.56, 1.1, 12),   // dark shading layer
    limb:    new THREE.CylinderGeometry(0.14, 0.11, 0.8, 8),
    forearm: new THREE.CylinderGeometry(0.11, 0.13, 0.65, 8),
    shin:    new THREE.CylinderGeometry(0.12, 0.10, 0.65, 8),
    horn:    new THREE.ConeGeometry(0.11, 0.44, 7),
    brow:    new THREE.BoxGeometry(0.72, 0.12, 0.24),
    eye:     new THREE.SphereGeometry(0.095, 8, 8),
    // jaw: flat wedge built as BoxGeometry, rotated open around top edge
    jaw:     new THREE.BoxGeometry(0.54, 0.14, 0.46),
    // claw cone (shared for all six claw tips)
    claw:    new THREE.ConeGeometry(0.055, 0.22, 5),
    // tail segments
    tailSeg0: new THREE.CylinderGeometry(0.13, 0.11, 0.38, 8),
    tailSeg1: new THREE.CylinderGeometry(0.11, 0.09, 0.32, 8),
    tailSeg2: new THREE.CylinderGeometry(0.09, 0.07, 0.28, 8),
    tailTip:  new THREE.ConeGeometry(0.07, 0.32, 7),
  };
  return G;
}

// Build three evenly-spread claws on a hand group
function addClaws(parent, g, clawMat) {
  const angles = [-0.45, 0, 0.45];
  for (const a of angles) {
    const c = new THREE.Mesh(g.claw, clawMat);
    // position at fingertip: slightly forward and splayed
    c.position.set(Math.sin(a) * 0.12, -0.36, Math.cos(a) * 0.06 + 0.08);
    c.rotation.x = -0.55;
    c.rotation.z = a * 0.4;
    parent.add(c);
  }
}

// Build segmented tail behind torso
function buildTail(root, g, tailMat, tipMat) {
  // pivot at base of spine (behind torso)
  const base = new THREE.Group();
  base.position.set(0, 1.25, -0.52);
  base.rotation.x = 0.55; // droops backward-down

  const s0 = new THREE.Mesh(g.tailSeg0, tailMat);
  s0.position.y = -0.19;
  base.add(s0);

  const j1 = new THREE.Group(); j1.position.y = -0.38; j1.rotation.x = 0.45;
  const s1 = new THREE.Mesh(g.tailSeg1, tailMat);
  s1.position.y = -0.16; j1.add(s1); base.add(j1);

  const j2 = new THREE.Group(); j2.position.y = -0.32; j2.rotation.x = 0.45;
  const s2 = new THREE.Mesh(g.tailSeg2, tailMat);
  s2.position.y = -0.14; j2.add(s2); j1.add(j2);

  const tip = new THREE.Mesh(g.tailTip, tipMat);
  tip.position.y = -0.26; tip.rotation.x = Math.PI; // point downward
  j2.add(tip);

  root.add(base);
  return base;
}

/**
 * Build an Imp model.
 * @param {number} tint  - hex color for skin
 * @returns {{ root, parts: {armL,armR,legL,legR,jaw}, skin, mats }}
 */
export function buildImp(tint) {
  const g = geos();

  // Materials — ALL transparent:true so death-fade opacity works uniformly
  const skin    = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.70, metalness: 0.0, envMapIntensity: 0.3, transparent: true });
  const belly   = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.75, metalness: 0.0, envMapIntensity: 0.2, transparent: true, opacity: 0.32 }); // dark belly overlay
  const brow    = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.75, metalness: 0.0, envMapIntensity: 0.2, transparent: true, opacity: 0.55 }); // dark brow ridge
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.60, metalness: 0.1, envMapIntensity: 0.3, transparent: true });
  const eyeMat  = new THREE.MeshStandardMaterial({ color: 0xffe000, emissive: new THREE.Color(0xffe000), emissiveIntensity: 2.0, roughness: 0.4, metalness: 0.0, envMapIntensity: 0.3, transparent: true });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0xe8ddb5, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.3, transparent: true });
  const tailMat = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.72, metalness: 0.0, envMapIntensity: 0.3, transparent: true });
  const tailTip = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.60, metalness: 0.1, envMapIntensity: 0.3, transparent: true });
  const jawMat  = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.70, metalness: 0.0, envMapIntensity: 0.3, transparent: true });

  const mats = [skin, belly, brow, hornMat, eyeMat, clawMat, tailMat, tailTip, jawMat];

  const root = new THREE.Group();

  // Helper: add mesh directly to root
  const mk = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // --- Torso ---
  mk(g.torso, skin, 0, 1.35, 0);
  // dark belly shading (offset slightly forward, same shape)
  const bm = mk(g.belly, belly, 0, 1.35, 0.04);
  bm.scale.set(1.01, 1.0, 0.55); // flatten to front half only

  // --- Head ---
  mk(g.head, skin, 0, 2.18, 0);

  // Brow ridge
  const br = mk(g.brow, brow, 0, 2.26, 0.32);
  br.rotation.x = 0.25;

  // Horns
  const h1 = mk(g.horn, hornMat, -0.25, 2.6, 0); h1.rotation.z =  0.48;
  const h2 = mk(g.horn, hornMat,  0.25, 2.6, 0); h2.rotation.z = -0.48;

  // Eyes — emissive yellow glow
  mk(g.eye, eyeMat, -0.17, 2.21, 0.41);
  mk(g.eye, eyeMat,  0.17, 2.21, 0.41);

  // --- Jaw pivot (hinges at top edge of jaw, just under mouth) ---
  // jaw pivot sits at mouth line; rotating pivot.rotation.x opens it downward
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 1.96, 0.38);
  const jawMesh = new THREE.Mesh(g.jaw, jawMat);
  jawMesh.position.set(0, -0.07, 0.04); // hang below pivot
  jawPivot.add(jawMesh);
  root.add(jawPivot);

  // --- Arms (pivot groups so enemy.js can rotate them) ---
  const mkLimb = (x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const upper = new THREE.Mesh(g.limb, skin);
    upper.position.y = -0.4;
    pivot.add(upper);
    // forearm sub-pivot
    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.82;
    forearmPivot.rotation.x = 0.28;
    const fa = new THREE.Mesh(g.forearm, skin);
    fa.position.y = -0.325;
    forearmPivot.add(fa);
    // claws on forearm tip
    addClaws(forearmPivot, g, clawMat);
    pivot.add(forearmPivot);
    root.add(pivot);
    return pivot;
  };

  const armL = mkLimb(-0.6, 1.72);
  const armR = mkLimb( 0.6, 1.72);

  // --- Legs ---
  const mkLeg = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.82, 0);
    const upper = new THREE.Mesh(g.limb, skin);
    upper.position.y = -0.4;
    pivot.add(upper);
    const shinPivot = new THREE.Group();
    shinPivot.position.y = -0.82;
    shinPivot.rotation.x = -0.22;
    const sh = new THREE.Mesh(g.shin, skin);
    sh.position.y = -0.325;
    shinPivot.add(sh);
    pivot.add(shinPivot);
    root.add(pivot);
    return pivot;
  };

  const legL = mkLeg(-0.22);
  const legR = mkLeg( 0.22);

  // --- Tail ---
  buildTail(root, g, tailMat, tailTip);

  // Root scale: feet near y=0, top of head ~2.6 * 0.82 ≈ 2.13 world units
  root.scale.setScalar(0.82);

  // Enable shadow casting on all meshes
  root.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });

  return {
    root,
    parts: { armL, armR, legL, legR, jaw: jawPivot },
    skin,
    mats,
  };
}

/**
 * Build a Caster model — lean, robed/hooded, floats slightly off ground.
 * @param {number} tint
 * @returns {{ root, parts: {armL,armR,jaw}, skin, mats }}
 */
export function buildCaster(tint) {
  const g = geos();

  const skin    = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.70, metalness: 0.0,  envMapIntensity: 0.3, transparent: true });
  const robeMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.80, metalness: 0.05, envMapIntensity: 0.25, transparent: true });
  const robeRim = new THREE.MeshStandardMaterial({ color: 0x3d1a6e, roughness: 0.70, metalness: 0.1,  envMapIntensity: 0.3, transparent: true });
  const eyeMat  = new THREE.MeshStandardMaterial({ color: 0x8800ff, emissive: new THREE.Color(0x8800ff), emissiveIntensity: 2.0, roughness: 0.4, metalness: 0.0, envMapIntensity: 0.3, transparent: true });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: new THREE.Color(0xaa44ff), emissiveIntensity: 2.0, roughness: 0.4, metalness: 0.0, envMapIntensity: 0.3, transparent: true });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x8833aa, roughness: 0.65, metalness: 0.1,  envMapIntensity: 0.3, transparent: true });
  const jawMat  = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.70, metalness: 0.0,  envMapIntensity: 0.3, transparent: true });

  const mats = [skin, robeMat, robeRim, eyeMat, glowMat, hornMat, jawMat];

  const root = new THREE.Group();
  const mk = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // --- Robe body (wider cone = draped silhouette) ---
  const robeTorso = new THREE.CylinderGeometry(0.28, 0.52, 1.3, 12);
  mk(robeTorso, robeMat, 0, 1.25, 0);

  // robe hem (flat wide disc near ground)
  const robeHem = new THREE.CylinderGeometry(0.52, 0.6, 0.18, 14);
  mk(robeHem, robeRim, 0, 0.55, 0);

  // robe collar / chest accent
  const collar = new THREE.CylinderGeometry(0.30, 0.28, 0.16, 12);
  mk(collar, robeRim, 0, 1.95, 0);

  // --- Head (slightly smaller, more elongated) ---
  const headGeo = new THREE.SphereGeometry(0.42, 14, 12);
  mk(headGeo, skin, 0, 2.28, 0);

  // Hood (dark half-sphere draped over head)
  const hoodGeo = new THREE.SphereGeometry(0.50, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const hood = new THREE.Mesh(hoodGeo, robeMat);
  hood.position.set(0, 2.34, -0.06);
  root.add(hood);

  // Eyes — glowing purple (emissive)
  mk(g.eye, eyeMat, -0.15, 2.3, 0.35);
  mk(g.eye, eyeMat,  0.15, 2.3, 0.35);

  // Small horns (curved back)
  const h1 = mk(g.horn, hornMat, -0.18, 2.62, -0.05); h1.rotation.z =  0.6; h1.rotation.x = -0.3;
  const h2 = mk(g.horn, hornMat,  0.18, 2.62, -0.05); h2.rotation.z = -0.6; h2.rotation.x = -0.3;

  // Jaw pivot
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 2.04, 0.32);
  const jawMesh = new THREE.Mesh(g.jaw, jawMat);
  jawMesh.position.set(0, -0.07, 0.04);
  jawPivot.add(jawMesh);
  root.add(jawPivot);

  // --- Arms — thin, sleeve-covered, raised slightly ---
  const sleeveGeo = new THREE.CylinderGeometry(0.10, 0.13, 0.82, 8);
  const mkCasterArm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.82, 0);
    // rotate arm outward and slightly forward (spellcasting pose)
    pivot.rotation.z = x < 0 ? 0.5 : -0.5;
    pivot.rotation.x = -0.3;
    const upper = new THREE.Mesh(sleeveGeo, robeMat);
    upper.position.y = -0.41;
    pivot.add(upper);
    // glowing hand orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), glowMat);
    orb.position.y = -0.88;
    pivot.add(orb);
    root.add(pivot);
    return pivot;
  };

  const armL = mkCasterArm(-0.42);
  const armR = mkCasterArm( 0.42);

  // Floating offset: lift whole model so feet clear ground (~+0.18)
  root.position.y = 0.18;
  root.scale.setScalar(0.82);

  // Enable shadow casting on all meshes
  root.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });

  return {
    root,
    parts: { armL, armR, jaw: jawPivot },
    skin,
    mats,
  };
}

/**
 * Build a Charger model — bulky, large-scaled, heavy arms, small head.
 * @param {number} tint
 * @returns {{ root, parts: {armL,armR,legL,legR,jaw}, skin, mats }}
 */
export function buildCharger(tint) {
  const g = geos();

  const skin     = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.72, metalness: 0.0,  envMapIntensity: 0.3, transparent: true });
  const darkSkin = new THREE.MeshStandardMaterial({ color: 0x1a0800, roughness: 0.80, metalness: 0.0,  envMapIntensity: 0.2, transparent: true, opacity: 0.35 });
  const boneMat  = new THREE.MeshStandardMaterial({ color: 0xd4b483, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.3, transparent: true });
  const eyeMat   = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: new THREE.Color(0xff3300), emissiveIntensity: 2.0, roughness: 0.4, metalness: 0.0, envMapIntensity: 0.3, transparent: true });
  const clawMat  = new THREE.MeshStandardMaterial({ color: 0xc8bda0, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.3, transparent: true });
  const jawMat   = new THREE.MeshStandardMaterial({ color: tint,     roughness: 0.72, metalness: 0.0,  envMapIntensity: 0.3, transparent: true });

  const mats = [skin, darkSkin, boneMat, eyeMat, clawMat, jawMat];

  const root = new THREE.Group();
  const mk = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // --- Torso — wide and barrel-like ---
  const torsoGeo = new THREE.CylinderGeometry(0.62, 0.74, 1.3, 12);
  mk(torsoGeo, skin, 0, 1.4, 0);

  // dark belly overlay
  const bellyGeo = new THREE.CylinderGeometry(0.60, 0.72, 1.3, 12);
  const bm = new THREE.Mesh(bellyGeo, darkSkin);
  bm.position.set(0, 1.4, 0.05);
  bm.scale.set(1.01, 1.0, 0.5);
  root.add(bm);

  // Spine ridge (bone plates down the back)
  for (let i = 0; i < 3; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.12), boneMat);
    plate.position.set(0, 1.85 - i * 0.28, -0.62);
    plate.rotation.x = 0.2;
    root.add(plate);
  }

  // --- Head — small relative to body, sunk into shoulders ---
  const headGeo = new THREE.SphereGeometry(0.38, 14, 12);
  mk(headGeo, skin, 0, 2.12, 0);

  // Heavy brow ridge
  const browGeo = new THREE.BoxGeometry(0.72, 0.18, 0.28);
  const br = new THREE.Mesh(browGeo, darkSkin);
  br.position.set(0, 2.22, 0.28);
  br.rotation.x = 0.3;
  root.add(br);

  // Short stubby horns
  const h1 = mk(g.horn, boneMat, -0.22, 2.44, 0); h1.rotation.z =  0.3; h1.scale.setScalar(1.3);
  const h2 = mk(g.horn, boneMat,  0.22, 2.44, 0); h2.rotation.z = -0.3; h2.scale.setScalar(1.3);

  // Eyes — red glow (emissive)
  mk(g.eye, eyeMat, -0.14, 2.14, 0.32);
  mk(g.eye, eyeMat,  0.14, 2.14, 0.32);

  // Jaw pivot
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 1.9, 0.32);
  const jawMesh = new THREE.Mesh(g.jaw, jawMat);
  jawMesh.position.set(0, -0.07, 0.04);
  jawMesh.scale.set(1.1, 1.0, 1.0); // wider jaw
  jawPivot.add(jawMesh);
  root.add(jawPivot);

  // --- Heavy arms — thick upper arm, large forearms ---
  const heavyUpperGeo  = new THREE.CylinderGeometry(0.20, 0.17, 0.9, 8);
  const heavyForeGeo   = new THREE.CylinderGeometry(0.17, 0.20, 0.78, 8);
  const mkHeavyArm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.72, 0);
    const upper = new THREE.Mesh(heavyUpperGeo, skin);
    upper.position.y = -0.45;
    pivot.add(upper);
    const forePivot = new THREE.Group();
    forePivot.position.y = -0.92;
    forePivot.rotation.x = 0.2;
    const fa = new THREE.Mesh(heavyForeGeo, skin);
    fa.position.y = -0.39;
    forePivot.add(fa);
    addClaws(forePivot, g, clawMat);
    pivot.add(forePivot);
    root.add(pivot);
    return pivot;
  };

  const armL = mkHeavyArm(-0.82);
  const armR = mkHeavyArm( 0.82);

  // --- Legs — thick and sturdy ---
  const heavyLimbGeo = new THREE.CylinderGeometry(0.20, 0.17, 0.85, 8);
  const heavyShinGeo = new THREE.CylinderGeometry(0.17, 0.14, 0.7, 8);
  const mkHeavyLeg = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.88, 0);
    const upper = new THREE.Mesh(heavyLimbGeo, skin);
    upper.position.y = -0.425;
    pivot.add(upper);
    const shinPivot = new THREE.Group();
    shinPivot.position.y = -0.88;
    shinPivot.rotation.x = -0.2;
    const sh = new THREE.Mesh(heavyShinGeo, skin);
    sh.position.y = -0.35;
    shinPivot.add(sh);
    pivot.add(shinPivot);
    root.add(pivot);
    return pivot;
  };

  const legL = mkHeavyLeg(-0.3);
  const legR = mkHeavyLeg( 0.3);

  // Larger overall scale for tanky presence
  root.scale.setScalar(1.05);

  // Enable shadow casting on all meshes
  root.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });

  return {
    root,
    parts: { armL, armR, legL, legR, jaw: jawPivot },
    skin,
    mats,
  };
}
