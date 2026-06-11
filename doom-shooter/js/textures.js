import * as THREE from 'three';

const SIZE = 512;

function makeCanvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  // 노멀/러프니스 생성 시 getImageData를 반복 호출하므로 readback 최적화 컨텍스트 사용
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function repeatTex(canvas, aniso = 4) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// Convert a grayscale height canvas to a normal map canvas.
// Strength scales XY components; higher = more pronounced normals.
function heightToNormal(hCanvas, strength = 2.5) {
  const s = hCanvas.width;
  const hCtx = hCanvas.getContext('2d');
  const hData = hCtx.getImageData(0, 0, s, s).data;

  const [nCanvas, nCtx] = makeCanvas(s);
  const nImg = nCtx.createImageData(s, s);
  const nd = nImg.data;

  const h = (x, y) => {
    const xi = ((x % s) + s) % s;
    const yi = ((y % s) + s) % s;
    return hData[(yi * s + xi) * 4] / 255;
  };

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dX = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dY = (h(x, y + 1) - h(x, y - 1)) * strength;
      // normalise [-1..1] into [0..255]
      const len = Math.sqrt(dX * dX + dY * dY + 1);
      const i = (y * s + x) * 4;
      nd[i]     = ((-dX / len) * 0.5 + 0.5) * 255 | 0;
      nd[i + 1] = ((-dY / len) * 0.5 + 0.5) * 255 | 0;
      nd[i + 2] = (1 / len * 0.5 + 0.5) * 255 | 0;
      nd[i + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  return nCanvas;
}

// Build a roughnessMap canvas from a greyscale value image (same pixel order).
// roughBase 0-255. Adds ±variation noise.
function makeRoughnessCanvas(sourceCanvas, roughBase = 180, variation = 40) {
  const s = sourceCanvas.width;
  const sCtx = sourceCanvas.getContext('2d');
  const sData = sCtx.getImageData(0, 0, s, s).data;

  const [rCanvas, rCtx] = makeCanvas(s);
  const rImg = rCtx.createImageData(s, s);
  const rd = rImg.data;

  for (let i = 0; i < s * s; i++) {
    // Darker albedo pixels = rougher (e.g. mortar gaps, cracks)
    const lum = (sData[i * 4] + sData[i * 4 + 1] + sData[i * 4 + 2]) / 3;
    const v = Math.min(255, Math.max(0, roughBase - (lum / 255) * variation + (Math.random() - 0.5) * 15)) | 0;
    rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = v;
    rd[i * 4 + 3] = 255;
  }
  rCtx.putImageData(rImg, 0, 0);
  return rCanvas;
}

// Build a greyscale height canvas from an RGBA source (luminance as height).
function makeHeightCanvas(sourceCanvas) {
  const s = sourceCanvas.width;
  const sCtx = sourceCanvas.getContext('2d');
  const sData = sCtx.getImageData(0, 0, s, s).data;

  const [hCanvas, hCtx] = makeCanvas(s);
  const hImg = hCtx.createImageData(s, s);
  const hd = hImg.data;

  for (let i = 0; i < s * s; i++) {
    const lum = (sData[i * 4] * 0.299 + sData[i * 4 + 1] * 0.587 + sData[i * 4 + 2] * 0.114) | 0;
    hd[i * 4] = hd[i * 4 + 1] = hd[i * 4 + 2] = lum;
    hd[i * 4 + 3] = 255;
  }
  hCtx.putImageData(hImg, 0, 0);
  return hCanvas;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
const SHADES = [0.78, 0.9, 1.0, 1.12, 0.85, 1.06, 0.95];

function bevel(x, bx, by, bw, bh) {
  x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(bx, by, bw, 4);
  x.fillStyle = 'rgba(0,0,0,.34)'; x.fillRect(bx, by + bh - 6, bw, 6);
  x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(bx + bw - 4, by, 4, bh);
}
function stains(x, s = SIZE) {
  const scale = s / 256;
  for (const sx of [44, 150, 214].map(v => v * scale)) {
    const g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
    x.fillStyle = g; x.fillRect(sx, 0, 16 * scale, s);
  }
}

// brick courses with per-brick tonal variation (scaled to canvas size)
function bricks(x, theme, bw, bh, s = SIZE) {
  const sc = s / 256;
  bw *= sc; bh *= sc;
  const dark = theme.wall[2];
  x.fillStyle = dark; x.fillRect(0, 0, s, s);
  for (let row = 0; row < Math.ceil(s / bh) + 1; row++) {
    const off = (row % 2) ? -bw / 2 : 0;
    for (let i = -1; i < s / bw + 1; i++) {
      const bx = i * bw + off, by = row * bh;
      const idx = ((i * 3 + row * 7) % SHADES.length + SHADES.length) % SHADES.length;
      x.fillStyle = shade(theme.wall[(i + row) % 2 ? 0 : 1], SHADES[idx]);
      x.fillRect(bx + 4 * sc, by + 4 * sc, bw - 8 * sc, bh - 8 * sc);
      bevel(x, bx + 4 * sc, by + 4 * sc, bw - 8 * sc, bh - 8 * sc);
    }
  }
  stains(x, s);
}

// vertical plank / panel wall
function planks(x, theme, s = SIZE) {
  const sc = s / 256;
  const dark = theme.wall[2];
  x.fillStyle = dark; x.fillRect(0, 0, s, s);
  const pw = 42 * sc;
  for (let i = 0; i < s / pw + 1; i++) {
    const px = i * pw;
    x.fillStyle = shade(theme.wall[i % 2 ? 0 : 1], SHADES[(i * 5) % SHADES.length]);
    x.fillRect(px + 3 * sc, 2 * sc, pw - 6 * sc, (s - 4 * sc));
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(px + 3 * sc, 2 * sc, 3 * sc, (s - 4 * sc));
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(px + pw - 6 * sc, 2 * sc, 4 * sc, (s - 4 * sc));
    for (const by of [16 * sc, (s - 16 * sc)]) {
      x.fillStyle = '#15110c'; x.beginPath(); x.arc(px + pw / 2, by, 4 * sc, 0, 7); x.fill();
    }
  }
  stains(x, s);
}

function addCracks(x, s = SIZE) {
  const sc = s / 256;
  x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3 * sc;
  for (const pts of [
    [40, 10, 70, 90, 55, 180],
    [200, 30, 170, 120, 210, 210],
    [120, 60, 100, 150]
  ]) {
    x.beginPath(); x.moveTo(pts[0] * sc, pts[1] * sc);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i] * sc, pts[i + 1] * sc);
    x.stroke();
  }
  x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(150 * sc, 150 * sc, 26 * sc, 22 * sc);
}

function addStain(x, theme, s = SIZE) {
  const sc = s / 256;
  const splotch = theme.kind === 'stone' ? 'rgba(70,110,40,.5)'
    : theme.kind === 'hell' ? 'rgba(120,20,10,.5)' : 'rgba(150,90,30,.45)';
  x.fillStyle = splotch;
  for (let i = 0; i < 80; i++) x.fillRect(((i * 53) % 256) * sc, (150 + (i * 31) % 100) * sc, 7 * sc, 7 * sc);
}

function addFeature(x, xe, theme, s = SIZE) {
  const sc = s / 256;
  if (theme.kind === 'stone') {
    x.fillStyle = '#3c2a14'; x.fillRect(96 * sc, 70 * sc, 64 * sc, 120 * sc);
    x.fillStyle = '#15100a';
    for (const by of [78, 176]) for (const bx of [104, 148]) {
      x.beginPath(); x.arc(bx * sc, by * sc, 5 * sc, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(70,110,40,.55)';
    for (let i = 0; i < 60; i++) x.fillRect(((i * 53) % 256) * sc, (180 + (i * 17) % 60) * sc, 6 * sc, 6 * sc);
    return false;
  } else if (theme.kind === 'hell') {
    const lava = (ctx, glow) => {
      ctx.lineWidth = (glow ? 6 : 4) * sc;
      for (const v of [
        [20, 0, 60, 80, 40, 150, 90, 256],
        [180, 0, 150, 90, 200, 170, 160, 256],
        [110, 40, 130, 130, 100, 220]
      ]) {
        const g = ctx.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, '#ffd24d'); g.addColorStop(1, '#ff3a00');
        ctx.strokeStyle = glow ? '#ff7a1e' : g;
        ctx.beginPath(); ctx.moveTo(v[0] * sc, v[1] * sc);
        for (let i = 2; i < v.length; i += 2) ctx.lineTo(v[i] * sc, v[i + 1] * sc);
        ctx.stroke();
      }
    };
    lava(x, false); lava(xe, true); return true;
  } else {
    // tech
    x.fillStyle = '#11161a'; x.fillRect(40 * sc, 60 * sc, 80 * sc, 140 * sc);
    x.fillStyle = '#2a333c';
    for (let i = 0; i < 8; i++) x.fillRect(46 * sc, (66 + i * 16) * sc, 68 * sc, 9 * sc);
    for (let i = 0; i < 6; i++) {
      x.fillStyle = i % 2 ? '#1a1a10' : '#caa820';
      x.save(); x.translate(150 * sc, 70 * sc); x.rotate(0.5);
      x.fillRect(0, i * 22 * sc, 90 * sc, 11 * sc); x.restore();
    }
    for (const [lx, ly] of [[150, 200], [170, 200], [190, 200]]) {
      xe.fillStyle = '#35c6ff'; xe.beginPath(); xe.arc(lx * sc, ly * sc, 5 * sc, 0, 7); xe.fill();
      x.fillStyle = '#8fe0ff'; x.beginPath(); x.arc(lx * sc, ly * sc, 5 * sc, 0, 7); x.fill();
    }
    return true;
  }
}

// Build PBR texture set from an albedo canvas.
// Returns { map, normalMap, roughnessMap } THREE.CanvasTextures (all RepeatWrapping).
function pbrSet(albedoCanvas, roughBase = 180, normalStrength = 2.5) {
  const hCanvas = makeHeightCanvas(albedoCanvas);
  const nCanvas = heightToNormal(hCanvas, normalStrength);
  const rCanvas = makeRoughnessCanvas(albedoCanvas, roughBase);
  return {
    map: repeatTex(albedoCanvas),
    normalMap: repeatTex(nCanvas),
    roughnessMap: repeatTex(rCanvas),
  };
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────

/**
 * makeWallTextures(theme)
 * Returns:
 *   { variants: Array<{
 *       map: CanvasTexture,
 *       normalMap: CanvasTexture,
 *       roughnessMap: CanvasTexture,
 *       emissive?: number (0xRRGGBB, only on feature variants),
 *       emissiveMap?: CanvasTexture | null
 *     }>
 *   }
 * 7 variants (indices 0-6). Variant 6 is the feature wall.
 * Hell/tech feature walls have emissive = 0xffffff and a non-null emissiveMap.
 */
export function makeWallTextures(theme) {
  const variants = [];

  const brickVariant = (bw, bh, deco) => {
    const [c, x] = makeCanvas(SIZE);
    bricks(x, theme, bw, bh, SIZE);
    if (deco) deco(x, SIZE);
    return pbrSet(c, 190, 2.0);
  };

  variants.push(brickVariant(120, 52));                                        // 0 running brick
  variants.push(brickVariant(86, 86));                                         // 1 small square block
  variants.push(brickVariant(130, 84));                                        // 2 large block masonry
  variants.push(brickVariant(120, 52, addCracks));                             // 3 cracked
  variants.push(brickVariant(120, 52, (x, s) => addStain(x, theme, s)));      // 4 stained

  { // 5 planks
    const [c, x] = makeCanvas(SIZE);
    planks(x, theme, SIZE);
    variants.push(pbrSet(c, 160, 1.5));
  }

  { // 6 feature wall (emissive on hell/tech)
    const [c, x] = makeCanvas(SIZE);
    const [ce, xe] = makeCanvas(SIZE);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, SIZE, SIZE);
    bricks(x, theme, 120, 52, SIZE);
    const hasE = addFeature(x, xe, theme, SIZE);
    const base = pbrSet(c, 200, 2.5);
    const variant = { ...base };
    if (hasE) {
      variant.emissive = theme.kind === 'hell' ? 0xff5500 : 0x35c6ff;
      variant.emissiveMap = repeatTex(ce);
    }
    variants.push(variant);
  }

  return { variants };
}

/**
 * makeFloorTexture(theme)
 * Returns: { map, normalMap, roughnessMap }
 */
export function makeFloorTexture(theme) {
  const [a, b] = theme.floor;
  const [c, x] = makeCanvas(SIZE);
  const sc = SIZE / 256;
  x.fillStyle = a; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++) {
      x.fillStyle = ((i + j) % 2) ? b : a;
      x.fillRect(i * 52 * sc, j * 52 * sc, 50 * sc, 50 * sc);
      x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 2 * sc;
      x.strokeRect(i * 52 * sc, j * 52 * sc, 50 * sc, 50 * sc);
    }
  x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 4 * sc;
  x.strokeRect(0, 0, SIZE, SIZE);
  return pbrSet(c, 210, 1.8);
}

/**
 * makeCeilTexture(theme)
 * Returns: { map, normalMap, roughnessMap }
 */
export function makeCeilTexture(theme) {
  const [c, x] = makeCanvas(SIZE);
  const sc = SIZE / 256;
  x.fillStyle = theme.ceil; x.fillRect(0, 0, SIZE, SIZE);
  x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 3 * sc;
  for (let i = 0; i <= SIZE; i += 64 * sc) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, SIZE); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(SIZE, i); x.stroke();
  }
  return pbrSet(c, 230, 1.2);
}

/**
 * makeBarrelTexture()
 * Returns: { map, normalMap, roughnessMap }
 */
export function makeBarrelTexture() {
  const [c, x] = makeCanvas(256); // barrel stays 256 — small prop
  x.fillStyle = '#5a4a22'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#6e5a2c';
  for (let i = 0; i < 4; i++) x.fillRect(0, 12 + i * 30, 256, 18);
  x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 12, 256, 4);
  x.fillStyle = '#2a2218';
  x.fillRect(0, 6, 256, 6); x.fillRect(0, 116, 256, 6);
  x.fillStyle = '#caff3a';
  x.beginPath(); x.arc(128, 128, 30, 0, 7); x.fill();
  x.fillStyle = '#1a1a10'; x.font = 'bold 44px monospace'; x.textAlign = 'center';
  x.fillText('☣', 128, 144);

  const hCanvas = makeHeightCanvas(c);
  const nCanvas = heightToNormal(hCanvas, 3.0);
  const rCanvas = makeRoughnessCanvas(c, 200, 50);

  return {
    map: repeatTex(c),
    normalMap: repeatTex(nCanvas),
    roughnessMap: repeatTex(rCanvas),
  };
}

// ── Flame / glow helpers (unchanged, no PBR needed — sprite billboards) ──

export function makeFlameTexture() {
  const [c, x] = makeCanvas(64);
  x.clearRect(0, 0, 64, 64);
  const grad = x.createRadialGradient(32, 40, 2, 32, 36, 30);
  grad.addColorStop(0, '#fff6c0');
  grad.addColorStop(0.3, '#ffd24d');
  grad.addColorStop(0.6, '#ff7a1e');
  grad.addColorStop(1, 'rgba(180,40,0,0)');
  x.fillStyle = grad;
  x.beginPath();
  x.moveTo(32, 4); x.quadraticCurveTo(58, 36, 32, 60); x.quadraticCurveTo(6, 36, 32, 4);
  x.fill();
  return new THREE.CanvasTexture(c);
}

export function makeGlowTexture() {
  const [c, x] = makeCanvas(64);
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
