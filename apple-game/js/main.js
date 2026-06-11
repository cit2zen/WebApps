// 엔트리: 게임/보드/타이머를 묶고 UI를 갱신한다.
import { Game } from "./game.js";
import { Board } from "./board.js";
import { Timer, formatMMSS } from "./timer.js";
import { initSettings } from "./settings.js";
import { tick, timeUp } from "./sfx.js";

const DURATION = 120_000; // 2분

const $ = (id) => document.getElementById(id);
const scoreEl = $("score");
const bestEl = $("best");
const timeEl = $("time");
const timeStat = timeEl.closest(".stat");
const timebar = $("timebar");
const overlay = $("overlay");
const finalScore = $("finalScore");
const overlayKicker = $("overlayKicker");
const overlaySub = $("overlaySub");
const confetti = $("confetti");
const replayBtn = $("replay");
const startOverlay = $("startOverlay");

const BEST_KEY = "apple-game-best";
let best = Number(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = best;

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

// 점수 구간별 성취 카피 (0점·고득점이 같은 문구로 밋밋하던 문제 보완)
function praise(score, newBest) {
  if (newBest && score > 0) return "🏆 최고 기록 경신!";
  if (score >= 1000) return "대단해요! 사과 마스터";
  if (score >= 600) return "훌륭해요! 멋진 수확";
  if (score >= 300) return "좋아요! 점점 느는데요";
  if (score > 0) return "사과를 수확했어요";
  return "다음엔 더 많이 모아봐요";
}

function endGame(win) {
  timer.stop();
  board.setEnabled(false);
  const score = game.score;
  finalScore.textContent = score;
  const newBest = score > best;
  if (newBest) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem(BEST_KEY, String(best));
  }
  if (win) {
    overlayKicker.textContent = "🎉 CLEAR!";
    overlaySub.textContent = "모든 사과를 수확했어요! 축하합니다";
    overlay.classList.add("overlay--win");
    spawnConfetti();
  } else {
    overlayKicker.textContent = "TIME'S UP · 시간 종료";
    overlaySub.textContent = praise(score, newBest);
    overlay.classList.remove("overlay--win");
    timeUp();
  }
  overlay.hidden = false;
  // 키보드 사용자가 Enter로 바로 재시작할 수 있게 포커스 이동
  replayBtn.focus();
}

function spawnConfetti() {
  const colors = ["#e8b54a", "#ff6a5a", "#6bc46e", "#ff4d4d"];
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
// 시작 게이트: 로드 시 자동 시작하지 않고, '시작하기'가 '다시 하기'와 같은 경로(startGame)를 탄다.
$("start").addEventListener("click", () => {
  startOverlay.hidden = true;
  startGame();
});

initSettings();
board.setEnabled(false); // 시작 전 입력 잠금(타이머도 startGame에서만 시작)
