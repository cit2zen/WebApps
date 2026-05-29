import { Maze, COLS, ROWS, T } from "./maze.js";
import { Pacman } from "./pacman.js";
import { Ghost } from "./ghost.js";
import { Input, DIR } from "./input.js";
import { Hud } from "./hud.js";
import { Audio } from "./audio.js";
import { Settings } from "./settings.js";

const SCHEDULE = [
  { mode: "scatter", t: 7000 },
  { mode: "chase", t: 20000 },
  { mode: "scatter", t: 7000 },
  { mode: "chase", t: 20000 },
  { mode: "scatter", t: 5000 },
  { mode: "chase", t: 20000 },
  { mode: "scatter", t: 5000 },
  { mode: "chase", t: Infinity },
];

const FRIGHT_MS = 7000;
const FRIGHT_FLASH_MS = 2000;
const HIGH_KEY = "neon-pacman-high";

class Game {
  constructor() {
    this.canvas = document.getElementById("board");
    this.ctx = this.canvas.getContext("2d");
    this.maze = new Maze();
    this.hud = new Hud();
    this.audio = new Audio();
    this.input = new Input(() => this._onStart());
    this.paused = false;
    this.settings = new Settings(this.audio, {
      onOpen: () => { this.paused = true; },
      onClose: () => { this.paused = false; },
    });

    this.pac = new Pacman(this.maze, this.input);
    this.ghosts = this._makeGhosts();
    this.blinky = this.ghosts[0];
    for (const g of this.ghosts) { g.pac = this.pac; g.blinky = this.blinky; }

    this.state = "TITLE";
    this.score = 0;
    this.high = Number(localStorage.getItem(HIGH_KEY) || 0);
    this.lives = 3;
    this.level = 1;
    this.frame = 0;
    this.startRequested = false;

    this._resize();
    window.addEventListener("resize", () => this._resize());

    this.hud.setHigh(this.high);
    this.hud.setLives(this.lives);
    this.hud.setLevel(this.level);
    this.hud.showOverlay("NEON<br>PAC-MAN", "PRESS ENTER / TAP TO START");

    this.last = 0;
    requestAnimationFrame((t) => this._loop(t));
  }

  _makeGhosts() {
    return [
      new Ghost(this.maze, "blinky", { x: 13, y: 11, color: "#ff2b4e", corner: { x: 26, y: 0 }, releaseDelay: 0, state: "out" }),
      new Ghost(this.maze, "pinky", { x: 13, y: 14, color: "#ff5bd1", corner: { x: 1, y: 0 }, releaseDelay: 1200, state: "house" }),
      new Ghost(this.maze, "inky", { x: 11, y: 14, color: "#18e0ff", corner: { x: 26, y: 30 }, releaseDelay: 5000, state: "house" }),
      new Ghost(this.maze, "clyde", { x: 15, y: 14, color: "#ffb347", corner: { x: 1, y: 30 }, releaseDelay: 9000, state: "house" }),
    ];
  }

  _resize() {
    const maxW = Math.min(window.innerWidth * 0.92, 560);
    const maxH = window.innerHeight * 0.74;
    const tile = Math.max(6, Math.floor(Math.min(maxW / COLS, maxH / ROWS)));
    this.tile = tile;
    this.canvas.width = COLS * tile;
    this.canvas.height = ROWS * tile;
  }

  _onStart() {
    this.audio._ensure();
    if (this.state === "TITLE" || this.state === "GAMEOVER" || this.state === "WIN") {
      this.startRequested = true;
    }
  }

  _newGame() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.maze.reset();
    this.hud.setScore(0);
    this.hud.setLevel(1);
    this.hud.setLives(this.lives);
    this._startLevel();
  }

  _startLevel() {
    this._resetActors();
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.frightTimer = 0;
    this.eatChain = 0;
    this.levelClock = 0;
    for (const g of this.ghosts) g.setMode("scatter");
    this.state = "READY";
    this.readyTimer = 1600;
    this.hud.showOverlay(null, "READY!");
  }

  _resetActors() {
    this.pac.reset();
    for (const g of this.ghosts) g.reset();
  }

  _onStart_to_play() {
    this.hud.hideOverlay();
    this.state = "PLAYING";
    this.audio.startBgm();
  }

  _frighten() {
    this.frightTimer = FRIGHT_MS;
    this.eatChain = 0;
    for (const g of this.ghosts) g.setScared(true);
  }

  _update(dtMs) {
    const dt = Math.min(dtMs / 16.6667, 3);
    this.frame += dt;

    if (this.state === "TITLE" || this.state === "GAMEOVER" || this.state === "WIN") {
      if (this.startRequested) { this.startRequested = false; this._newGame(); }
      return;
    }

    if (this.state === "READY") {
      this.readyTimer -= dtMs;
      if (this.readyTimer <= 0) this._onStart_to_play();
      return;
    }

    if (this.state === "DYING") {
      this.dyingTimer -= dtMs;
      if (this.dyingTimer <= 0) {
        if (this.lives <= 0) {
          this.state = "GAMEOVER";
          this.audio.stopBgm();
          this.hud.showOverlay("GAME<br>OVER", "PRESS ENTER / TAP TO RETRY");
        } else {
          // 목숨이 남으면 시작 위치로 돌아가지 않고 그 자리에서 재개.
          // 즉사 방지를 위해 유령만 집으로 되돌린다.
          for (const gh of this.ghosts) gh.reset();
          this.pac.dir = DIR.NONE;
          this.input.requested = DIR.NONE;
          this.hud.hideOverlay();
          this.state = "PLAYING";
        }
      }
      return;
    }

    // PLAYING
    this.levelClock += dtMs;
    for (const g of this.ghosts) if (this.levelClock >= g.releaseDelay) g.release();

    // 모드 스케줄 (frightened 동안 정지)
    if (this.frightTimer > 0) {
      this.frightTimer -= dtMs;
      if (this.frightTimer <= 0) {
        for (const g of this.ghosts) g.setScared(false);
      }
    } else {
      const phase = SCHEDULE[this.modeIndex];
      this.modeTimer += dtMs;
      if (this.modeTimer >= phase.t && this.modeIndex < SCHEDULE.length - 1) {
        this.modeIndex++;
        this.modeTimer = 0;
        for (const g of this.ghosts) g.setMode(SCHEDULE[this.modeIndex].mode);
      }
    }

    this.pac.update(dt);

    // 점 먹기
    const eaten = this.maze.eat(this.pac.col, this.pac.row);
    if (eaten === T.PELLET) { this._addScore(10); this.audio.chomp(); }
    else if (eaten === T.POWER) { this._addScore(50); this.audio.power(); this._frighten(); }

    if (this.maze.pelletCount <= 0) { this._levelWin(); return; }

    const flashHigh = this.frightTimer > 0 && this.frightTimer < FRIGHT_FLASH_MS;
    for (const g of this.ghosts) g.update(dt, flashHigh);

    this._collide();
  }

  _addScore(n) {
    this.score += n;
    this.hud.setScore(this.score);
    if (this.score > this.high) {
      this.high = this.score;
      this.hud.setHigh(this.high);
      localStorage.setItem(HIGH_KEY, String(this.high));
    }
  }

  _collide() {
    for (const g of this.ghosts) {
      if (Math.abs(g.x - this.pac.x) > 0.5 || Math.abs(g.y - this.pac.y) > 0.5) continue;
      if (g.scared && g.state !== "eaten") {
        this.eatChain++;
        this._addScore(200 * Math.pow(2, this.eatChain - 1));
        g.getEaten();
        this.audio.eatGhost();
      } else if (g.state === "out" && !g.scared) {
        this._die();
        return;
      }
    }
  }

  _die() {
    this.lives--;
    this.hud.setLives(this.lives);
    this.audio.death();
    this.state = "DYING";
    this.dyingTimer = 1500;   // 깜빡임을 볼 수 있도록
  }

  _levelWin() {
    this.level++;
    this.hud.setLevel(this.level);
    this.audio.win();
    this.maze.reset();
    this.state = "READY";
    this.readyTimer = 1800;
    this._resetActors();
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.frightTimer = 0;
    this.levelClock = 0;
    for (const g of this.ghosts) g.setMode("scatter");
    this.hud.showOverlay(null, "LEVEL " + this.level);
  }

  _draw() {
    const { ctx, tile } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.maze.draw(ctx, tile, this.frame);
    if (this.state === "DYING") {
      // 사망 중: 유령 숨기고 팩맨만 깜빡임
      if (Math.floor(this.frame * 0.2) % 2 === 0) this.pac.draw(ctx, tile);
    } else if (this.state !== "TITLE" && this.state !== "GAMEOVER") {
      this.pac.draw(ctx, tile);
      for (const g of this.ghosts) g.draw(ctx, tile, this.frame);
    }
  }

  _loop(t) {
    const dtMs = this.last ? t - this.last : 16.6;
    this.last = t;
    this.audio.update();           // BGM 스케줄링 (rAF 기반)
    if (!this.paused) this._update(dtMs);
    this._draw();
    requestAnimationFrame((nt) => this._loop(nt));
  }
}

window.addEventListener("DOMContentLoaded", () => { window.GAME = new Game(); });
