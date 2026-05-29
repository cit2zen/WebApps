// 엔트리: 게임/보드/타이머를 묶고 UI를 갱신한다.
import { Game } from "./game.js";
import { Board } from "./board.js";
import { Timer, formatMMSS } from "./timer.js";
import { initSettings } from "./settings.js";
import { tick, timeUp } from "./sfx.js";

const DURATION = 120_000; // 2분

const $ = (id) => document.getElementById(id);
const scoreEl = $("score");
const timeEl = $("time");
const timeStat = timeEl.closest(".stat");
const timebar = $("timebar");
const overlay = $("overlay");
const finalScore = $("finalScore");
const overlayKicker = $("overlayKicker");
const overlaySub = $("overlaySub");
const confetti = $("confetti");

const game = new Game();
const board = new Board(
  game, $("grid"), $("selrect"),
  (s) => { scoreEl.textContent = s; },
  () => endGame(true)
);

let lastTickSec = -1;
const timer = new Timer(
  DURATION,
  (remaining, frac) => {
    timeEl.textContent = formatMMSS(remaining);
    timebar.style.transform = `scaleX(${frac})`;
    const low = remaining <= 10_000;
    timeStat.classList.toggle("low", low);
    // 마지막 10초: 매 초 째깍 경고음
    const sec = Math.ceil(remaining / 1000);
    if (low && remaining > 0 && sec !== lastTickSec) { lastTickSec = sec; tick(); }
  },
  () => endGame(false)
);

function startGame() {
  game.reset();
  board.render();
  board.setEnabled(true);
  scoreEl.textContent = "0";
  lastTickSec = -1;
  timeStat.classList.remove("low");
  overlay.classList.remove("overlay--win");
  confetti.innerHTML = "";
  overlay.hidden = true;
  timer.start();
}

function endGame(win) {
  timer.stop();
  board.setEnabled(false);
  finalScore.textContent = game.score;
  if (win) {
    overlayKicker.textContent = "🎉 CLEAR!";
    overlaySub.textContent = "모든 사과를 수확했어요! 축하합니다";
    overlay.classList.add("overlay--win");
    spawnConfetti();
  } else {
    overlayKicker.textContent = "TIME'S UP";
    overlaySub.textContent = "사과를 수확했어요";
    overlay.classList.remove("overlay--win");
    timeUp();
  }
  overlay.hidden = false;
}

function spawnConfetti() {
  const colors = ["#e8b54a", "#ff6a5a", "#6bc46e", "#f4ecd8", "#ff4d4d"];
  let html = "";
  for (let i = 0; i < 44; i++) {
    const left = (Math.random() * 100).toFixed(1);
    const c = colors[(Math.random() * colors.length) | 0];
    const delay = (Math.random() * 0.7).toFixed(2);
    const x = ((Math.random() * 220 - 110) | 0);
    html += `<i style="left:${left}%;background:${c};animation-delay:${delay}s;--x:${x}px"></i>`;
  }
  confetti.innerHTML = html;
}

$("reset").addEventListener("click", startGame);
$("replay").addEventListener("click", startGame);

initSettings();
startGame();
