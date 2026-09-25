// minimap.js — top-down radar canvas overlaid on the HUD
import { CELL } from './maps.js';

const MAP_CELL = 4; // pixels per grid cell on the minimap canvas
const CANVAS_SIZE = 150;

// 색은 Polaroid 토큰(design-tokens.css + style.css :root)에서 읽는다 — hex 하드코딩 금지
const TYPE_TOKENS = {
  imp: '--pol-danger',
  caster: '--pol-info',
  charger: '--doom-amber',
  boss: '--doom-plum',
};
let _pal = null;
function palette() {
  if (_pal) return _pal;
  const cs = getComputedStyle(document.documentElement);
  const t = (name) => cs.getPropertyValue(name).trim();
  const p = {
    wall: t('--ink-light'),
    floor: t('--cream-300'),
    exit: t('--pol-ok'),
    player: t('--ink-warm'),
    enemy: t('--pol-danger'),
    type: Object.fromEntries(Object.entries(TYPE_TOKENS).map(([k, v]) => [k, t(v)])),
  };
  if (p.wall) _pal = p; // 스타일시트 로드 전이면 다음 프레임에 다시 읽음
  return p;
}

export class MiniMap {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._init();
  }

  _init() {
    if (document.getElementById('minimap')) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'minimap';
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    // #hud 안에 넣어 메뉴/일시정지/사망 화면에서 HUD와 함께 숨겨지게 한다
    (document.getElementById('hud') ?? document.body).appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
  }

  update(level, cameraPos, cameraDir, enemies) {
    if (!this._canvas) this._init();
    const ctx = this._ctx;
    if (!ctx) return;
    if (!level || !level.bounds || !level.isWall) return;

    const { minX, maxX, minZ, maxZ } = level.bounds;
    const mapW = maxX - minX + CELL;
    const mapH = maxZ - minZ + CELL;

    const cols = Math.round(mapW / CELL);
    const rows = Math.round(mapH / CELL);
    const cw = cols * MAP_CELL;
    const ch = rows * MAP_CELL;
    const offX = Math.floor((CANVAS_SIZE - cw) / 2);
    const offZ = Math.floor((CANVAS_SIZE - ch) / 2);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const pal = palette();

    // draw grid cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = minX + c * CELL;
        const wz = minZ + r * CELL;
        const px = offX + c * MAP_CELL;
        const pz = offZ + r * MAP_CELL;
        if (level.isWall(wx, wz)) {
          ctx.fillStyle = pal.wall;
        } else {
          ctx.fillStyle = pal.floor;
        }
        ctx.fillRect(px, pz, MAP_CELL, MAP_CELL);
      }
    }

    // draw exit cell
    if (level.exitCell) {
      const { r, c } = level.exitCell;
      const px = offX + c * MAP_CELL;
      const pz = offZ + r * MAP_CELL;
      ctx.fillStyle = pal.exit;
      ctx.fillRect(px, pz, MAP_CELL, MAP_CELL);
    }

    // draw enemies as dots
    if (Array.isArray(enemies)) {
      for (const e of enemies) {
        const pos = e?.root?.position || e?.position;
        if (!pos) continue;
        // skip dead enemies
        if (e.dead) continue;
        if (e.hp !== undefined && e.hp <= 0) continue;
        const ex = pos.x;
        const ez = pos.z;
        const px = offX + ((ex - minX) / CELL) * MAP_CELL + MAP_CELL / 2;
        const pz = offZ + ((ez - minZ) / CELL) * MAP_CELL + MAP_CELL / 2;
        const color = pal.type[e.type] || pal.enemy;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // draw player arrow
    if (cameraPos) {
      const px = offX + ((cameraPos.x - minX) / CELL) * MAP_CELL + MAP_CELL / 2;
      const pz = offZ + ((cameraPos.z - minZ) / CELL) * MAP_CELL + MAP_CELL / 2;
      const angle = cameraDir ? Math.atan2(cameraDir.x, cameraDir.z) : 0;
      const arrowLen = 6;
      const arrowW = 3;

      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(angle);
      ctx.fillStyle = pal.player;
      ctx.beginPath();
      ctx.moveTo(0, -arrowLen);
      ctx.lineTo(arrowW, arrowLen * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-arrowW, arrowLen * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  reset() {
    if (!this._ctx) return;
    this._ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
}
