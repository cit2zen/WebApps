// 장애물(선인장) 생성·이동·충돌. 우→좌로 흐른다.
export class ObstacleManager {
  constructor(width, groundY) {
    this.width = width;
    this.groundY = groundY;
    this.items = [];
    this._distToNext = 360; // 다음 장애물까지 남은 거리(px)
  }

  reset() {
    this.items = [];
    this._distToNext = 360;
  }

  // speed: px/s. dt: 초. seed 함수는 0~1 난수.
  update(dt, speed, rand) {
    const move = speed * dt;
    for (const o of this.items) o.x -= move;
    this.items = this.items.filter((o) => o.x + o.w > -10);

    this._distToNext -= move;
    if (this._distToNext <= 0) {
      this._spawn(rand);
      // 속도가 빨라질수록 간격을 살짝 넓혀 난이도 균형
      const base = 300 + rand() * 220;
      const speedPad = (speed - 220) * 0.45;
      this._distToNext = base + Math.max(0, speedPad);
    }
  }

  _spawn(rand) {
    const tall = rand() > 0.6;
    const h = tall ? 70 + rand() * 28 : 38 + rand() * 22;
    const w = 22 + rand() * 16;
    this.items.push({ x: this.width + 20, w, h });
  }

  // catBox와 AABB 충돌 시 true.
  collides(catBox) {
    for (const o of this.items) {
      const oy = this.groundY - o.h;
      if (
        catBox.x < o.x + o.w &&
        catBox.x + catBox.w > o.x &&
        catBox.y < this.groundY &&
        catBox.y + catBox.h > oy
      ) {
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    for (const o of this.items) {
      const baseY = this.groundY;
      const top = baseY - o.h;
      ctx.save();
      ctx.fillStyle = "#5fb86f";
      ctx.strokeStyle = "#3f9954";
      ctx.lineWidth = 2;

      // 몸통
      this._roundRect(ctx, o.x, top, o.w, o.h, o.w * 0.45, true);
      // 양팔(작은 가지)
      const armY = top + o.h * 0.45;
      const aw = o.w * 0.5;
      this._roundRect(ctx, o.x - aw * 0.7, armY, aw, o.w * 0.5, aw * 0.4, true);
      this._roundRect(ctx, o.x + o.w - aw * 0.3, armY - o.h * 0.12, aw, o.w * 0.5, aw * 0.4, true);

      // 점박이 무늬
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(o.x + o.w * 0.5, top + o.h * 0.3, 2.5, 0, Math.PI * 2);
      ctx.arc(o.x + o.w * 0.4, top + o.h * 0.6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, w, h, r, stroke) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
    if (stroke) ctx.stroke();
  }
}
