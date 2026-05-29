// 게임 루프 + 상태 관리 + 충돌/점수/생명/속도.
import { Cat } from "./cat.js";
import { ObstacleManager } from "./obstacles.js";
import { Background } from "./background.js";

const BEST_KEY = "yaong-jump-best";

export class Game {
  constructor(canvas, audio, settings, sfx) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = canvas.width;
    this.H = canvas.height;
    this.groundY = this.H - 70;

    this.audio = audio;
    this.settings = settings;
    this.sfx = sfx;

    this.cat = new Cat(this.groundY);
    this.obstacles = new ObstacleManager(this.W, this.groundY);
    this.bg = new Background(this.W, this.H, this.groundY);

    this.state = "idle"; // idle | playing | gameover
    this.lives = 3;
    this.distance = 0;
    this.speed = 220;
    this.invuln = 0;       // 무적 시간(초)
    this._charging = false; // 점프 피크 측정 중
    this._chargePeak = 0;
    this._chargeTime = 0;
    this._armed = true;     // 임계 아래로 떨어져야 다음 점프 가능(연속 점프 방지)
    this._pointMark = 0;   // 효과음용 점수 마일스톤
    this.best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;

    this.onLivesChange = null;
    this.onScoreChange = null;
    this.onGameOver = null;

    this._last = 0;
    this._raf = null;
    this._loop = this._loop.bind(this);

    // 결정적이지 않은 난수가 필요하므로 Math.random 래핑(테스트 시 주입 가능)
    this.rand = Math.random;
  }

  start() {
    this.state = "playing";
    this.lives = 3;
    this.distance = 0;
    this.speed = 220;
    this.invuln = 0;
    this._charging = false;
    this._chargePeak = 0;
    this._chargeTime = 0;
    this._armed = true;
    this._pointMark = 0;
    this.cat.reset();
    this.obstacles.reset();
    this._emitLives();
    this._emitScore();
    this._last = 0;
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }

  _loop(ts) {
    if (this.state !== "playing") return;
    if (!this._last) this._last = ts;
    let dt = (ts - this._last) / 1000;
    this._last = ts;
    if (dt > 0.05) dt = 0.05; // 탭 비활성 등으로 인한 점프 방지

    this._step(dt);
    this._render();

    this._raf = requestAnimationFrame(this._loop);
  }

  // 한 프레임 진행(테스트에서 직접 호출 가능).
  _step(dt) {
    // 속도 점진 증가
    this.speed = Math.min(560, this.speed + 8 * dt);
    this.distance += this.speed * dt;

    // 음성 입력 → 점프. 임계 통과 후 짧은 창 동안 '피크 음량'을 측정해
    // 그 세기에 비례한 높이로 점프한다(크게 외칠수록 높이).
    const level = this.audio.getLevel();
    const th = this.settings.threshold;
    const CHARGE = 0.11; // 피크 측정 창(초)

    if (this._charging) {
      this._chargePeak = Math.max(this._chargePeak, level);
      this._chargeTime += dt;
      // 창이 끝나거나 소리가 확 잦아들면 발사
      if (this._chargeTime >= CHARGE || level < th * 0.5) {
        const power = Math.min(1, (this._chargePeak - th) / (1 - th));
        this.cat.jump(power);
        if (this.sfx) this.sfx.jump();
        this._charging = false;
      }
    } else if (this._armed && level > th && this.cat.onGround) {
      this._charging = true;
      this._chargePeak = level;
      this._chargeTime = 0;
      this._armed = false;
    }
    if (level < th) this._armed = true; // 임계 아래로 내려와야 재점프

    this.cat.update(dt);
    this.obstacles.update(dt, this.speed, this.rand);
    this.bg.update(dt, this.speed);

    // 충돌
    if (this.invuln > 0) {
      this.invuln -= dt;
    } else if (this.obstacles.collides(this.cat.hitbox())) {
      this.lives -= 1;
      this.invuln = 1.2;
      this._emitLives();
      if (this.sfx) this.sfx.hit();
      if (this.lives <= 0) this._end();
    }

    // 100m마다 경쾌한 효과음
    const score = this.scoreValue();
    if (score >= this._pointMark + 100) {
      this._pointMark = Math.floor(score / 100) * 100;
      if (this.sfx) this.sfx.point();
    }

    this._emitScore();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this.bg.draw(ctx);
    this.obstacles.draw(ctx);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0;
    this.cat.draw(ctx, blink);
  }

  _end() {
    this.state = "gameover";
    cancelAnimationFrame(this._raf);
    if (this.sfx) this.sfx.gameover();
    const score = this.scoreValue();
    if (score > this.best) {
      this.best = score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    if (this.onGameOver) this.onGameOver(score, this.best);
  }

  scoreValue() {
    return Math.floor(this.distance / 10);
  }

  _emitLives() {
    if (this.onLivesChange) this.onLivesChange(this.lives);
  }
  _emitScore() {
    if (this.onScoreChange) this.onScoreChange(this.scoreValue());
  }
}
