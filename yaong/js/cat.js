// 고양이 캐릭터: 점프 물리 + canvas 드로잉.
export class Cat {
  constructor(groundY) {
    this.startX = 130;
    this.x = this.startX;
    this.w = 54;
    this.h = 46;
    this.groundY = groundY;
    this.y = groundY - this.h; // 좌상단 기준
    this.vy = 0;
    this.gravity = 2100;       // px/s^2
    this.minJump = 520;        // 약한 소리 점프 속도
    this.maxJump = 880;        // 큰 소리 점프 속도
    this.onGround = true;
    this.legPhase = 0;         // 달리기 애니메이션
  }

  // power: 0~1 (음량 세기). 클수록 높이 점프.
  jump(power) {
    if (!this.onGround) return;
    const p = Math.max(0, Math.min(1, power));
    this.vy = -(this.minJump + (this.maxJump - this.minJump) * p);
    this.onGround = false;
  }

  update(dt) {
    this.vy += this.gravity * dt;
    this.y += this.vy * dt;
    const floor = this.groundY - this.h;
    if (this.y >= floor) {
      this.y = floor;
      this.vy = 0;
      this.onGround = true;
    }
    this.legPhase += dt * 12;
  }

  reset() {
    this.x = this.startX; // 가로 위치 복원(앞으로 순간이동 잔존 방지)
    this.y = this.groundY - this.h;
    this.vy = 0;
    this.onGround = true;
  }

  // 충돌 판정용 박스(시각보다 약간 작게 → 너그럽게).
  hitbox() {
    return { x: this.x + 8, y: this.y + 6, w: this.w - 16, h: this.h - 10 };
  }

  draw(ctx, blink) {
    if (blink) return; // 무적 깜빡임 동안 잠깐 안 보임
    const { x, y, w, h } = this;
    const cx = x + w / 2;
    const bodyY = y + h * 0.4;

    ctx.save();
    // 그림자 — 높이 뛸수록 작아지고 옅어진다
    const maxH = (this.maxJump * this.maxJump) / (2 * this.gravity);
    const airT = Math.max(0, Math.min(1, (this.groundY - this.h - y) / maxH));
    const shrink = 1 - 0.65 * airT;
    ctx.fillStyle = `rgba(70,110,150,${(0.18 * (1 - 0.7 * airT)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(cx, this.groundY - 2, w * 0.42 * shrink, 7 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();

    const orange = "#ffb455";
    const orangeDark = "#f59a31";

    // 꼬리 (살랑)
    ctx.strokeStyle = orange;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    const tailWag = Math.sin(this.legPhase) * 5;
    ctx.beginPath();
    ctx.moveTo(x + 4, bodyY + h * 0.25);
    ctx.quadraticCurveTo(x - 14, bodyY - 4 + tailWag, x - 8, bodyY - 18 + tailWag);
    ctx.stroke();

    // 다리 (달리기)
    const swing = this.onGround ? Math.sin(this.legPhase) * 6 : 4;
    ctx.fillStyle = orangeDark;
    this._roundRect(ctx, cx - 14, bodyY + h * 0.42, 9, 12 + swing, 4);
    this._roundRect(ctx, cx + 5, bodyY + h * 0.42, 9, 12 - swing, 4);

    // 몸통
    ctx.fillStyle = orange;
    this._roundRect(ctx, x + 6, bodyY, w - 12, h * 0.5, 14);

    // 머리
    const hr = w * 0.34;
    const hcx = cx + 8;
    const hcy = y + hr * 0.7;
    ctx.beginPath();
    ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
    ctx.fill();

    // 귀
    ctx.beginPath();
    ctx.moveTo(hcx - hr * 0.8, hcy - hr * 0.5);
    ctx.lineTo(hcx - hr * 0.3, hcy - hr * 1.25);
    ctx.lineTo(hcx - hr * 0.05, hcy - hr * 0.55);
    ctx.moveTo(hcx + hr * 0.8, hcy - hr * 0.5);
    ctx.lineTo(hcx + hr * 0.3, hcy - hr * 1.25);
    ctx.lineTo(hcx + hr * 0.05, hcy - hr * 0.55);
    ctx.fillStyle = orange;
    ctx.fill();
    // 귀 안쪽
    ctx.fillStyle = "#ffd9c2";
    ctx.beginPath();
    ctx.moveTo(hcx - hr * 0.55, hcy - hr * 0.6);
    ctx.lineTo(hcx - hr * 0.32, hcy - hr * 1.05);
    ctx.lineTo(hcx - hr * 0.18, hcy - hr * 0.62);
    ctx.fill();

    // 볼 홍조
    ctx.fillStyle = "rgba(255,140,160,0.55)";
    ctx.beginPath();
    ctx.arc(hcx - hr * 0.6, hcy + hr * 0.25, 5, 0, Math.PI * 2);
    ctx.arc(hcx + hr * 0.6, hcy + hr * 0.25, 5, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (점프 중엔 ^^ 표정)
    ctx.fillStyle = "#3a2a1a";
    if (this.onGround) {
      ctx.beginPath();
      ctx.arc(hcx - hr * 0.35, hcy - hr * 0.05, 3.4, 0, Math.PI * 2);
      ctx.arc(hcx + hr * 0.35, hcy - hr * 0.05, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3a2a1a";
      ctx.beginPath();
      ctx.moveTo(hcx - hr * 0.5, hcy - hr * 0.02);
      ctx.lineTo(hcx - hr * 0.2, hcy - hr * 0.18);
      ctx.moveTo(hcx + hr * 0.2, hcy - hr * 0.18);
      ctx.lineTo(hcx + hr * 0.5, hcy - hr * 0.02);
      ctx.stroke();
    }

    // 코
    ctx.fillStyle = "#ff7a90";
    ctx.beginPath();
    ctx.arc(hcx, hcy + hr * 0.22, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }
}
