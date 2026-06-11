// HUD DOM 갱신 + 오버레이 제어.
// 오버레이 이중화: 로비(#lobby — 타이틀/게임오버, 불투명 풀스크린)
//                인게임(#overlay — READY!/PAUSED, 반투명·미로 위)
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.scoreEl = $("score");
    this.highEl = $("high");
    this.livesEl = $("lives");
    this.levelEl = $("level");
    this.overlay = $("overlay");
    this.msgEl = $("overlay-msg");
    this.lobby = $("lobby");
    this.lobbyTitleEl = $("lobby-title");
    this.lobbyDescEl = $("lobby-desc");
    this.startBtn = $("start-btn");
  }

  setScore(s) { this.scoreEl.textContent = s; }
  setHigh(s) { this.highEl.textContent = s; }
  setLevel(l) { this.levelEl.textContent = l; }
  setLives(n) { this.livesEl.textContent = "ᗧ".repeat(Math.max(0, n)); }

  showLobby(title, desc) {
    if (title) this.lobbyTitleEl.textContent = title;
    if (desc) this.lobbyDescEl.textContent = desc;
    this.lobby.classList.remove("hidden");
  }

  hideLobby() {
    this.lobby.classList.add("hidden");
  }

  showOverlay(msg) {
    this.msgEl.textContent = msg;
    this.overlay.classList.remove("hidden");
  }

  hideOverlay() {
    this.overlay.classList.add("hidden");
  }
}
