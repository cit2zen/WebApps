// 패럴럭스 구름 배경 + 하늘 + 바닥.
import { PAL } from "./palette.js";
export class Background {
  constructor(width, height, groundY) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;
    this.clouds = [];
    this.groundOffset = 0;
    this._seed();
  }

  _seed() {
    // 초기 구름 배치 (결정적 의사난수)
    let s = 7;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: r() * this.width,
        y: 30 + r() * (this.groundY - 120),
        scale: 0.6 + r() * 0.9,
        speed: 0.25 + r() * 0.4, // 패럴럭스 계수
      });
    }
  }

  update(dt, speed) {
    for (const c of this.clouds) {
      c.x -= speed * c.speed * dt;
      if (c.x < -120 * c.scale) {
        // 리스폰 y는 매번 무작위로 분산(고정식이면 모든 구름이 같은 높이로 수렴)
        c.x = this.width + 60;
        c.y = 30 + Math.random() * (this.groundY - 140);
      }
    }
    this.groundOffset = (this.groundOffset + speed * dt) % 48;
  }

  draw(ctx) {
    // 하늘 그라데이션
    const sky = ctx.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, PAL.skyTop);
    sky.addColorStop(1, PAL.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.groundY);

    // 구름
    for (const c of this.clouds) this._cloud(ctx, c.x, c.y, c.scale);

    // 바닥(잔디 + 흙)
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(0, this.groundY, this.width, 14);
    ctx.fillStyle = PAL.dirt;
    ctx.fillRect(0, this.groundY + 14, this.width, this.height - this.groundY - 14);

    // 바닥 점선 무늬(스크롤)
    ctx.save();
    ctx.fillStyle = PAL.dash;
    ctx.globalAlpha = 0.6;
    for (let x = -this.groundOffset; x < this.width; x += 48) {
      ctx.fillRect(x, this.groundY + 22, 18, 5);
    }
    ctx.restore();
  }

  _cloud(ctx, x, y, s) {
    ctx.save();
    ctx.fillStyle = PAL.cloud;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y + 4 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x - 24 * s, y + 6 * s, 16 * s, 0, Math.PI * 2);
    ctx.arc(x + 4 * s, y - 14 * s, 16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
