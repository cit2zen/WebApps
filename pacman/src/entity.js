// 격자 기반 이동 코어. 위치는 타일 단위(정수=타일 중심).
// 항상 타일 중심에서만 방향을 결정하므로 벽 관통이 없다.
import { DIR } from "./input.js";
import { COLS } from "./maze.js";

const EPS = 1e-6;

export class Entity {
  constructor(maze, x, y) {
    this.maze = maze;
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.dir = DIR.NONE;
    this.speed = 0.12;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.dir = DIR.NONE;
  }

  get col() { return Math.round(this.x); }
  get row() { return Math.round(this.y); }

  // 서브클래스가 구현: 타일 중심에서 this.dir 결정
  decide(_c, _r) {}
  // 서브클래스가 구현: 해당 칸 진입 가능 여부
  canPass(_c, _r) { return true; }

  advance(dt) {
    let remaining = this.speed * dt;
    let guard = 0;
    while (remaining > EPS && guard++ < 64) {
      const cx = Math.round(this.x);
      const cy = Math.round(this.y);
      const aligned = Math.abs(this.x - cx) < EPS && Math.abs(this.y - cy) < EPS;
      if (aligned) {
        this.x = cx;
        this.y = cy;
        this.decide(cx, cy);
        if (this.dir === DIR.NONE) return;
        if (!this.canPass(cx + this.dir.x, cy + this.dir.y)) {
          this.dir = DIR.NONE;
          return;
        }
      }
      // 현재 진행 방향으로 "다음 타일 중심"까지 남은 거리.
      // 정렬돼 있지 않을 때도 중심을 건너뛰지 않도록 정확히 계산한다.
      let dist;
      if (this.dir.x > 0) dist = Math.floor(this.x) + 1 - this.x;
      else if (this.dir.x < 0) dist = this.x - (Math.ceil(this.x) - 1);
      else if (this.dir.y > 0) dist = Math.floor(this.y) + 1 - this.y;
      else dist = this.y - (Math.ceil(this.y) - 1);
      if (dist < EPS) dist = 1; // 정렬 직후엔 한 칸 전진

      const step = Math.min(remaining, dist);
      this.x += this.dir.x * step;
      this.y += this.dir.y * step;
      remaining -= step;
      this._wrap();
    }
  }

  _wrap() {
    if (this.x <= -1) this.x += COLS;
    else if (this.x >= COLS) this.x -= COLS;
  }
}
