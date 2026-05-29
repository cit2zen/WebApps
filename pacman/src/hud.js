// HUD DOM 갱신.
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.scoreEl = $("score");
    this.highEl = $("high");
    this.livesEl = $("lives");
    this.levelEl = $("level");
    this.overlay = $("overlay");
    this.msgEl = $("overlay-msg");
    this.titleEl = document.querySelector(".neon-title");
  }

  setScore(s) { this.scoreEl.textContent = s; }
  setHigh(s) { this.highEl.textContent = s; }
  setLevel(l) { this.levelEl.textContent = l; }
  setLives(n) { this.livesEl.textContent = "ᗧ".repeat(Math.max(0, n)); }

  showOverlay(title, msg) {
    if (title) this.titleEl.innerHTML = title;
    this.msgEl.textContent = msg;
    this.overlay.classList.remove("hidden");
  }

  hideOverlay() {
    this.overlay.classList.add("hidden");
  }
}
