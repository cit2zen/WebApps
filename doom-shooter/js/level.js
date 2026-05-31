import * as THREE from 'three';
import { CELL } from './maps.js';
import { makeWallTextures, makeFloorTexture, makeCeilTexture } from './textures.js';
import { THEMES } from './themes.js';
import { makeTorch, makeBarrel, makePillar } from './decor.js';

const WALL_H = 4;

// Per-theme PBR texture caches — generated once, shared across stage reloads.
// Only 3 themes exist so these never go stale. Do NOT dispose per-stage.
const _wallCache = new Map();
const _floorCache = new Map();
const _ceilCache = new Map();

function getCachedWallTextures(theme) {
  if (!_wallCache.has(theme.kind)) _wallCache.set(theme.kind, makeWallTextures(theme));
  return _wallCache.get(theme.kind);
}
function getCachedFloorTexture(theme) {
  if (!_floorCache.has(theme.kind)) _floorCache.set(theme.kind, makeFloorTexture(theme));
  return _floorCache.get(theme.kind);
}
function getCachedCeilTexture(theme) {
  if (!_ceilCache.has(theme.kind)) _ceilCache.set(theme.kind, makeCeilTexture(theme));
  return _ceilCache.get(theme.kind);
}

// cell (r,c) center -> world (c*CELL, y, r*CELL)
export function buildLevel(scene, map) {
  const grid = map.grid;
  const rows = grid.length;
  const cols = grid[0].length;
  const theme = THEMES[map.themeIndex];
  const pbr = theme.pbr;
  const disposables = [];
  const objects = [];
  const flickerLights = [];

  const add = (mesh) => { scene.add(mesh); objects.push(mesh); return mesh; };
  const track = (...things) => { disposables.push(...things); };

  // atmosphere — fog + ambient/hemisphere lighting owned by this level
  scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
  const ambient = new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity);
  const hemi = new THREE.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
  scene.add(ambient, hemi); objects.push(ambient, hemi);

  // floor + ceiling — use cached texture sets to avoid redundant normal/roughness generation
  const floorSet = getCachedFloorTexture(theme);
  floorSet.map.repeat.set(cols, rows);
  floorSet.normalMap.repeat.set(cols, rows);
  floorSet.roughnessMap.repeat.set(cols, rows);

  const ceilSet = getCachedCeilTexture(theme);
  ceilSet.map.repeat.set(cols, rows);
  ceilSet.normalMap.repeat.set(cols, rows);
  ceilSet.roughnessMap.repeat.set(cols, rows);

  const planeGeo = new THREE.PlaneGeometry(cols * CELL, rows * CELL);
  const cx = cols * CELL / 2 - CELL / 2;
  const cz = rows * CELL / 2 - CELL / 2;

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorSet.map,
    normalMap: floorSet.normalMap,
    roughnessMap: floorSet.roughnessMap,
    roughness: pbr.floorRough,
    metalness: pbr.metal,
    envMapIntensity: pbr.envIntensity,
  });
  const floor = add(new THREE.Mesh(planeGeo, floorMat));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;

  const ceilMat = new THREE.MeshStandardMaterial({
    map: ceilSet.map,
    normalMap: ceilSet.normalMap,
    roughnessMap: ceilSet.roughnessMap,
    roughness: pbr.ceilRough,
    metalness: pbr.metal,
    envMapIntensity: pbr.envIntensity,
  });
  const ceil = add(new THREE.Mesh(planeGeo, ceilMat));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_H, cz);
  ceil.receiveShadow = true;

  // Cached textures are NOT disposed per-stage (shared across stages).
  // Only dispose per-stage geometry and materials.
  track(planeGeo, floorMat, ceilMat);

  // walls — several variants picked per cell by deterministic hash
  const boxGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  track(boxGeo);

  // Use cached wall texture set — textures are not tracked/disposed per-stage.
  const wallTextureSet = getCachedWallTextures(theme);
  const wallMats = wallTextureSet.variants.map((v) => {
    const opts = {
      map: v.map,
      normalMap: v.normalMap,
      roughnessMap: v.roughnessMap,
      roughness: pbr.wallRough,
      metalness: pbr.metal,
      envMapIntensity: pbr.envIntensity,
    };
    if (v.emissive !== undefined) {
      opts.emissive = new THREE.Color(v.emissive);
      opts.emissiveIntensity = 1.4;
      if (v.emissiveMap) opts.emissiveMap = v.emissiveMap;
    }
    const m = new THREE.MeshStandardMaterial(opts);
    track(m);
    return m;
  });

  const pickWallMat = (r, c) =>
    wallMats[(((r * 73856093) ^ (c * 19349663)) >>> 0) % wallMats.length];

  const isWallGrid = Array.from({ length: rows }, () => Array(cols).fill(false));
  const start = new THREE.Vector3(0, 1.6, 0);
  const spawnPoints = [];
  const pickupSpawns = [];
  let exitCell = null;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      const wx = c * CELL, wz = r * CELL;
      if (ch === '#') {
        const m = add(new THREE.Mesh(boxGeo, pickWallMat(r, c)));
        m.position.set(wx, WALL_H / 2, wz);
        m.castShadow = true;
        m.receiveShadow = true;
        isWallGrid[r][c] = true;
      } else if (ch === 'S') {
        start.set(wx, 1.6, wz);
      } else if (ch === 'E') {
        spawnPoints.push({ pos: new THREE.Vector3(wx, 1.5, wz), type: 'imp' });
      } else if (ch === 'C') {
        spawnPoints.push({ pos: new THREE.Vector3(wx, 1.5, wz), type: 'caster' });
      } else if (ch === 'K') {
        spawnPoints.push({ pos: new THREE.Vector3(wx, 1.5, wz), type: 'charger' });
      } else if (ch === 'Z') {
        spawnPoints.push({ pos: new THREE.Vector3(wx, 1.5, wz), type: 'boss' });
      } else if (ch === 'h') {
        pickupSpawns.push({ pos: new THREE.Vector3(wx, 0, wz), type: 'health' });
      } else if (ch === 'a') {
        pickupSpawns.push({ pos: new THREE.Vector3(wx, 0, wz), type: 'ammo' });
      } else if (ch === 'X') {
        exitCell = { r, c, x: wx, z: wz };
      } else if (ch === 'T') {
        const { mesh, light, base } = makeTorch(theme.torchColor);
        mesh.position.set(wx, 0, wz);
        // level torch lights stay castShadow=false per contract
        light.castShadow = false;
        add(mesh); flickerLights.push({ light, base });
      } else if (ch === 'B') {
        const { mesh, mat } = makeBarrel(); track(mat); mesh.position.set(wx, 0, wz); add(mesh);
      } else if (ch === 'P') {
        const { mesh, mat } = makePillar(theme); track(mat); mesh.position.set(wx, 0, wz); add(mesh);
      }
    }
  }

  // exit marker (starts dim, brightens when activated)
  let exitMesh = null, exitLight = null;
  if (exitCell) {
    const padGeo = new THREE.CircleGeometry(CELL * 0.42, 24);
    const padMat = new THREE.MeshBasicMaterial({ color: 0x224422 });
    exitMesh = add(new THREE.Mesh(padGeo, padMat));
    exitMesh.rotation.x = -Math.PI / 2;
    exitMesh.position.set(exitCell.x, 0.05, exitCell.z);
    exitLight = add(new THREE.PointLight(0x33ff66, 0, CELL * 4));
    exitLight.position.set(exitCell.x, 2, exitCell.z);
    track(padGeo, padMat);
  }

  function isWall(x, z) {
    const c = Math.round(x / CELL);
    const r = Math.round(z / CELL);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return true;
    return isWallGrid[r][c];
  }

  function atExit(pos) {
    if (!exitCell) return false;
    return Math.hypot(pos.x - exitCell.x, pos.z - exitCell.z) < CELL * 0.5;
  }

  function activateExit() {
    if (exitMesh) exitMesh.material.color.set(0x44ff88);
    if (exitLight) exitLight.intensity = 2.4;
  }

  function dispose() {
    for (const o of objects) scene.remove(o);
    for (const d of disposables) d.dispose?.();
    scene.fog = null;
  }

  const bounds = { minX: 0, maxX: (cols - 1) * CELL, minZ: 0, maxZ: (rows - 1) * CELL };

  return { start, spawnPoints, pickupSpawns, exitCell, isWall, atExit, activateExit, dispose, flickerLights, theme, bounds };
}
