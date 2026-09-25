// grid.js — 격자 모델(§2 규칙 1·2·6, §5 스키마): open/visited·wallSet·path
// idx = r·w + c (r=0 상단). DOM 없음.

export function wallKey(a, b) { return a < b ? a * 64 + b : b * 64 + a; }

export function buildWallSet(walls) {
  const s = new Set();
  if (Array.isArray(walls)) for (const p of walls) s.add(wallKey(p[0], p[1]));
  return s;
}

export class Grid {
  constructor(level) {
    this.level = level;
    this.w = level.w; this.h = level.h;
    const size = this.w * this.h;
    this.size = size;
    this.open = new Uint8Array(size).fill(1);
    for (const x of level.holes || []) this.open[x] = 0;
    this.n = size - (level.holes ? level.holes.length : 0);
    this.visited = new Uint8Array(size);
    this.pos = new Int16Array(size).fill(-1);          // 경로 내 index, 미방문 -1
    this.wallSet = buildWallSet(level.walls);
    this.start = level.start;
    this.end = level.end == null ? -1 : level.end;
    this.wpOrder = new Int16Array(size).fill(-1);       // 경유점 순번(0..Y-1)
    const wps = level.waypoints || [];
    wps.forEach((c, j) => { this.wpOrder[c] = j; });
    this.wpCount = wps.length;
    this.wpNext = 0;
    this.nb = [];                                       // 벽 제외 열린 이웃(사전 계산)
    for (let i = 0; i < size; i++) this.nb.push(this._neighbors(i));
    this.path = [];
    this.reset();
  }

  get len() { return this.path.length; }
  get head() { return this.path[this.path.length - 1]; }
  inBounds(i) { return Number.isInteger(i) && i >= 0 && i < this.size; }

  // 상하좌우 인접 + 벽 미통과
  adjacent(a, b) {
    if (!this.inBounds(a) || !this.inBounds(b)) return false;
    const ra = (a / this.w) | 0, rb = (b / this.w) | 0;
    const d = Math.abs(ra - rb) + Math.abs((a % this.w) - (b % this.w));
    return d === 1 && !this.wallSet.has(wallKey(a, b));
  }

  _neighbors(i) {
    const out = [], w = this.w, r = (i / w) | 0, c = i % w;
    const cand = [];
    if (r > 0) cand.push(i - w);
    if (r < this.h - 1) cand.push(i + w);
    if (c > 0) cand.push(i - 1);
    if (c < w - 1) cand.push(i + 1);
    for (const j of cand) if (this.open[j] && !this.wallSet.has(wallKey(i, j))) out.push(j);
    return out;
  }

  // 열린 이웃 목록(벽 제외) — 사전 계산 배열 참조 반환(수정 금지)
  neighbors(i) { return this.inBounds(i) ? this.nb[i] : []; }

  // 방향 → 목표 칸(격자 밖 -1)
  step(i, dir) {
    const w = this.w, r = (i / w) | 0, c = i % w;
    if (dir === 'up') return r > 0 ? i - w : -1;
    if (dir === 'down') return r < this.h - 1 ? i + w : -1;
    if (dir === 'left') return c > 0 ? i - 1 : -1;
    if (dir === 'right') return c < w - 1 ? i + 1 : -1;
    return -1;
  }

  // 규칙 1·2·5·6: push 불가 사유 → null(가능) | 'cell'(밖·구멍·방문) | 'far'(비인접) | 'wall' | 'wp'(경유점 순서) | 'end'(E 조기 진입)
  whyNot(c) {
    if (!this.inBounds(c) || !this.open[c] || this.visited[c]) return 'cell';
    const h = this.head, ra = (h / this.w) | 0, rb = (c / this.w) | 0;
    if (Math.abs(ra - rb) + Math.abs((h % this.w) - (c % this.w)) !== 1) return 'far';
    if (this.wallSet.has(wallKey(h, c))) return 'wall';
    const o = this.wpOrder[c];
    if (o >= 0 && o !== this.wpNext) return 'wp';
    if (c === this.end && this.len + 1 !== this.n) return 'end';
    return null;
  }
  canPush(c) { return this.whyNot(c) === null; }

  movable(head = this.head) {
    if (head !== this.head) {
      return this.neighbors(head).filter(j => !this.visited[j]);
    }
    return this.neighbors(head).filter(j => this.canPush(j));
  }

  pushRaw(c) {
    this.pos[c] = this.path.length; this.visited[c] = 1; this.path.push(c);
    if (this.wpOrder[c] >= 0) this.wpNext = this.wpOrder[c] + 1;
  }

  push(c) { if (!this.canPush(c)) return false; this.pushRaw(c); return true; }

  // 머리칸 제거 → 제거된 칸(len==1이면 -1, S 유지)
  pop() {
    if (this.path.length <= 1) return -1;
    const c = this.path.pop();
    this.pos[c] = -1; this.visited[c] = 0;
    if (this.wpOrder[c] >= 0) this.wpNext = this.wpOrder[c];
    return c;
  }

  // c까지 pop(c가 새 머리칸) → pop 개수(c가 경로 밖이면 0)
  cutTo(c) {
    const p = this.inBounds(c) ? this.pos[c] : -1;
    if (p < 0) return 0;
    let k = 0;
    while (this.path.length - 1 > p) { this.pop(); k++; }
    return k;
  }

  reset() {
    for (const c of this.path) { this.visited[c] = 0; this.pos[c] = -1; }
    this.path.length = 0; this.wpNext = 0;
    this.pushRaw(this.start);
  }

  indexOf(c) { return this.inBounds(c) ? this.pos[c] : -1; }
  remain() { return this.n - this.path.length; }
  isClear() {
    if (this.path.length !== this.n || this.wpNext !== this.wpCount) return false;
    return this.end < 0 || this.head === this.end;
  }
  isDeadEnd() { return this.path.length < this.n && this.movable().length === 0; }
}

export function createGrid(level) { return new Grid(level); }
