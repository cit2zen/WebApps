import { Entity } from "./entity.js";
import { DIR } from "./input.js";
import { COLS, ROWS } from "./maze.js";

const EXIT = { x: 13, y: 11 };  // 유령집 문 위
const HOME = { x: 13, y: 14 };  // 유령집 내부 복귀 지점

const SPEED_NORMAL = 0.105;
const SPEED_SCARED = 0.072;
const SPEED_EATEN = 0.07;

export class Ghost extends Entity {
  constructor(maze, type, opts) {
    super(maze, opts.x, opts.y);
    this.type = type;
    this.color = opts.color;
    this.corner = opts.corner;
    this.releaseDelay = opts.releaseDelay;
    this.homeX = opts.x;
    this.homeY = opts.y;
    this.startState = opts.state;
    this.reset();
  }

  reset() {
    super.reset();
    this.state = this.startState;        // house | leaving | out | eaten
    this.scared = false;
    this.mode = "scatter";               // 전역 모드(메인이 갱신)
    this.speed = SPEED_NORMAL;
    this.timer = 0;
    this.dir = this.state === "out" ? DIR.LEFT : DIR.NONE;
  }

  canPass(c, r) {
    if (this.maze.isWall(c, r)) return false;
    if (this.maze.isDoor(c, r)) {
      return this.state === "leaving" || this.state === "eaten";
    }
    return true;
  }

  setScared(on) {
    if (this.state === "eaten" || this.state === "house") return;
    if (on && !this.scared) this._reverse();
    this.scared = on;
    this.speed = on ? SPEED_SCARED : SPEED_NORMAL;
  }

  setMode(mode) {
    if (mode !== this.mode && this.state === "out" && !this.scared) this._reverse();
    this.mode = mode;
  }

  _reverse() {
    this.dir = { x: -this.dir.x, y: -this.dir.y };
  }

  release() {
    if (this.state === "house") this.state = "leaving";
  }

  _bob(cy) {
    if (this.dir !== DIR.UP && this.dir !== DIR.DOWN) this.dir = DIR.UP;
    if (cy <= 13) this.dir = DIR.DOWN;
    else if (cy >= 15) this.dir = DIR.UP;
  }

  _leave(cx, cy) {
    if (cx !== EXIT.x) { this.dir = cx < EXIT.x ? DIR.RIGHT : DIR.LEFT; return; }
    if (cy > EXIT.y) { this.dir = DIR.UP; return; }
    this.state = "out";
    this.scared = false;
    this.speed = SPEED_NORMAL;
    this.dir = DIR.LEFT;
  }

  _revive() {
    this.state = "leaving";
    this.scared = false;
    this.speed = SPEED_NORMAL;
  }

  _target(cx, cy) {
    const pac = this.pac;
    const pc = pac.col, pr = pac.row;
    const pd = pac.dir;
    switch (this.type) {
      case "blinky":
        return { x: pc, y: pr };
      case "pinky":
        return { x: pc + pd.x * 4, y: pr + pd.y * 4 };
      case "inky": {
        const ax = pc + pd.x * 2, ay = pr + pd.y * 2;
        const b = this.blinky;
        return { x: 2 * ax - b.col, y: 2 * ay - b.row };
      }
      case "clyde": {
        const d2 = (cx - pc) ** 2 + (cy - pr) ** 2;
        return d2 > 64 ? { x: pc, y: pr } : this.corner;
      }
      default:
        return { x: pc, y: pr };
    }
  }

  _pathTo(cx, cy, target, allowReverse, random) {
    const order = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];
    const back = { x: -this.dir.x, y: -this.dir.y };
    const opts = order.filter((d) => {
      if (!allowReverse && this.dir !== DIR.NONE && d.x === back.x && d.y === back.y) return false;
      return this.canPass(cx + d.x, cy + d.y);
    });
    if (opts.length === 0) return back;
    if (random) return opts[Math.floor(Math.random() * opts.length)];
    let best = opts[0], bd = Infinity;
    for (const d of opts) {
      const dist = (cx + d.x - target.x) ** 2 + (cy + d.y - target.y) ** 2;
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  // 집으로 복귀하기 위한 BFS 최단경로의 첫 스텝(문 통과 허용).
  _bfsDir(cx, cy, target) {
    const key = (c, r) => r * COLS + c;
    const start = key(cx, cy);
    const goal = key(target.x, target.y);
    if (start === goal) return null;
    const prev = new Map([[start, -1]]);
    const queue = [[cx, cy]];
    const dirs = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];
    let head = 0;
    let found = false;
    while (head < queue.length) {
      const [c, r] = queue[head++];
      if (c === target.x && r === target.y) { found = true; break; }
      for (const d of dirs) {
        let nc = c + d.x;
        const nr = r + d.y;
        if (nc < 0) nc = COLS - 1;
        else if (nc >= COLS) nc = 0;
        if (nr < 0 || nr >= ROWS) continue;
        if (this.maze.isWall(nc, nr)) continue; // 문(DOOR)은 벽이 아니므로 통과
        const k = key(nc, nr);
        if (prev.has(k)) continue;
        prev.set(k, key(c, r));
        queue.push([nc, nr]);
      }
    }
    if (!found) return null;
    // 목표에서 시작 직후 칸까지 역추적
    let cur = goal;
    while (prev.get(cur) !== start) {
      cur = prev.get(cur);
      if (cur === -1 || cur === undefined) return null;
    }
    const tc = cur % COLS;
    const tr = Math.floor(cur / COLS);
    let dx = tc - cx;
    const dy = tr - cy;
    if (dx > 1) dx = -1;       // 터널 래핑 보정
    else if (dx < -1) dx = 1;
    return { x: dx, y: dy };
  }

  decide(cx, cy) {
    switch (this.state) {
      case "house":
        this._bob(cy);
        return;
      case "leaving":
        this._leave(cx, cy);
        return;
      case "eaten":
        if (cx === HOME.x && cy === HOME.y) { this._revive(); this._bob(cy); return; }
        this.dir = this._bfsDir(cx, cy, HOME) || this._pathTo(cx, cy, HOME, true, false);
        return;
      default: {
        const target = this.scared ? { x: cx, y: cy } : this._target(cx, cy);
        this.dir = this._pathTo(cx, cy, target, false, this.scared);
      }
    }
  }

  update(dt, flashHigh) {
    this.timer += dt;
    this.advance(dt);
    this._flashHigh = flashHigh;
  }

  getEaten() {
    this.state = "eaten";
    this.scared = false;
    this.speed = SPEED_EATEN;
  }

  draw(ctx, tile, frame) {
    const px = this.x * tile + tile / 2;
    const py = this.y * tile + tile / 2;
    const r = tile * 0.46;

    if (this.state !== "eaten") {
      let body = this.color;
      if (this.scared) {
        body = this._flashHigh && Math.floor(frame * 0.2) % 2 === 0 ? "#ffffff" : "#2244ff";
      }
      ctx.fillStyle = body;
      ctx.shadowColor = body;
      ctx.shadowBlur = tile * 0.5;
      ctx.beginPath();
      ctx.arc(px, py - r * 0.1, r, Math.PI, 0);
      ctx.lineTo(px + r, py + r * 0.8);
      // 물결 치마
      const feet = 4;
      for (let i = 0; i < feet; i++) {
        const x0 = px + r - (2 * r) * (i / feet);
        const x1 = px + r - (2 * r) * ((i + 0.5) / feet);
        const x2 = px + r - (2 * r) * ((i + 1) / feet);
        ctx.lineTo(x1, py + r * 0.5);
        ctx.lineTo(x2, py + r * 0.8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 눈 (먹힌 상태는 눈만)
    const look = this.dir;
    const ex = look.x * r * 0.18;
    const ey = look.y * r * 0.18;
    for (const sx of [-0.32, 0.32]) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px + sx * r, py - r * 0.18, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.scared && this.state !== "eaten" ? "#2244ff" : "#1133cc";
      ctx.beginPath();
      ctx.arc(px + sx * r + ex, py - r * 0.18 + ey, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
