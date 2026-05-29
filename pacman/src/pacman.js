import { Entity } from "./entity.js";
import { DIR } from "./input.js";

export class Pacman extends Entity {
  constructor(maze, input) {
    super(maze, 13, 23);
    this.input = input;
    this.speed = 0.12;
    this.mouth = 0;       // 0..1 입 벌림
    this.mouthDir = 1;
  }

  reset() {
    super.reset();
    this.dir = DIR.NONE;
    this.input.requested = DIR.NONE;
  }

  canPass(c, r) {
    return !this.maze.isWallForPac(c, r);
  }

  decide(cx, cy) {
    const req = this.input.requested;
    if (req !== DIR.NONE && this.canPass(cx + req.x, cy + req.y)) {
      this.dir = req;
    }
    // 현재 방향이 막혀 있으면 advance()가 멈춤 처리
  }

  update(dt) {
    this.advance(dt);
    // 입 애니메이션
    if (this.dir !== DIR.NONE) {
      this.mouth += this.mouthDir * 0.12 * dt;
      if (this.mouth > 1) { this.mouth = 1; this.mouthDir = -1; }
      if (this.mouth < 0) { this.mouth = 0; this.mouthDir = 1; }
    }
  }

  draw(ctx, tile) {
    const px = this.x * tile + tile / 2;
    const py = this.y * tile + tile / 2;
    const r = tile * 0.46;
    let angle = 0;
    if (this.dir === DIR.LEFT) angle = Math.PI;
    else if (this.dir === DIR.UP) angle = -Math.PI / 2;
    else if (this.dir === DIR.DOWN) angle = Math.PI / 2;
    const open = this.mouth * 0.32 * Math.PI;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = "#ffe600";
    ctx.shadowColor = "#ffd000";
    ctx.shadowBlur = tile * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, open, Math.PI * 2 - open);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}
