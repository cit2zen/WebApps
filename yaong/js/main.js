// DOM 연결: 화면 전환(대기→준비→플레이→게임오버), 설정, 미터, 효과음.
import { AudioManager } from "./audio.js";
import { Settings } from "./settings.js";
import { SoundFX } from "./sfx.js";
import { Music } from "./music.js";
import { Game } from "./game.js";

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const audio = new AudioManager();
const settings = new Settings();
const sfx = new SoundFX();
const music = new Music();
const game = new Game(canvas, audio, settings, sfx);

const screens = {
  start: $("start-screen"),
  ready: $("ready-screen"),
  settings: $("settings-screen"),
  gameover: $("gameover-screen"),
};
const hud = $("hud");
let meterRaf = null;
let returnFrom = "start"; // 설정에서 '돌아가기' 시 복귀할 화면

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle("hidden", k !== name);
  hud.classList.toggle("hidden", name !== "playing");
  // 설정/준비 화면이 아니면 미터 루프 정지
  if (name !== "settings" && name !== "ready") stopMeter();
}

// --- HUD 갱신 ---
game.onLivesChange = (n) => {
  $("lives").textContent = "💗".repeat(Math.max(0, n)) + "🤍".repeat(Math.max(0, 3 - n));
};
game.onScoreChange = (s) => {
  $("score").textContent = `${s} m`;
};
game.onGameOver = (score, best) => {
  $("final-score").textContent = score;
  $("best-result").textContent = `최고 기록 ${best} m`;
  show("gameover");
};

// --- 마이크 보장 ---
async function ensureMic() {
  if (audio.ready) {
    audio.resume();
    return true;
  }
  return audio.init();
}

// --- 음량 미터 루프 (준비/설정 화면 공용) ---
function startMeter(fillEl, thresholdEl, statusEl) {
  stopMeter();
  if (thresholdEl) thresholdEl.style.left = `${settings.threshold * 100}%`;
  const tick = () => {
    const lv = audio.getLevel();
    fillEl.style.width = `${Math.min(100, lv * 100)}%`;
    meterRaf = requestAnimationFrame(tick);
  };
  tick();
  ensureMic().then((ok) => {
    if (statusEl) statusEl.textContent = ok ? "" : "마이크 권한을 허용해 주세요 🎤";
  });
}
function stopMeter() {
  cancelAnimationFrame(meterRaf);
  meterRaf = null;
}

// --- 화면 전환 동작 ---
function goHome() {
  game.stop();
  $("best-line").textContent = game.best ? `최고 기록 ${game.best} m` : "";
  show("start");
}

async function goReady() {
  sfx.click();
  music.start();
  returnFrom = "ready";
  show("ready");
  await ensureMic();
  startMeter($("ready-meter-fill"), $("ready-meter-threshold"), $("ready-mic-status"));
}

function beginGame() {
  sfx.click();
  stopMeter();
  show("playing");
  game.start();
}

function openSettings(from) {
  sfx.click();
  music.start();
  returnFrom = from;
  show("settings");
  startMeter($("meter-fill"), $("meter-threshold"), $("mic-status"));
}

function closeSettings() {
  sfx.click();
  if (returnFrom === "ready") goReady();
  else goHome();
}

// --- 버튼 연결 ---
$("start-btn").addEventListener("click", goReady);
$("ready-start").addEventListener("click", beginGame);
$("ready-back").addEventListener("click", goHome);
$("retry-btn").addEventListener("click", beginGame);
$("home-btn").addEventListener("click", () => { sfx.click(); goHome(); });

$("settings-btn").addEventListener("click", () => openSettings("start"));
$("ready-settings").addEventListener("click", () => openSettings("ready"));
$("gameover-settings").addEventListener("click", () => openSettings("gameover"));
$("settings-back").addEventListener("click", closeSettings);

// --- 설정 컨트롤 ---
const sens = $("sensitivity");
const sensVal = $("sensitivity-val");
sens.value = settings.sensitivity;
sensVal.textContent = settings.sensitivity;
sens.addEventListener("input", () => {
  settings.set(parseInt(sens.value, 10));
  sensVal.textContent = settings.sensitivity;
  $("meter-threshold").style.left = `${settings.threshold * 100}%`;
});

const soundToggle = $("sound-toggle");
soundToggle.checked = !sfx.muted;
soundToggle.addEventListener("change", () => {
  sfx.setMuted(!soundToggle.checked);
  if (soundToggle.checked) sfx.click();
});

const musicToggle = $("music-toggle");
musicToggle.checked = !music.muted;
musicToggle.addEventListener("change", () => {
  music.setMuted(!musicToggle.checked);
});

// --- 시작 화면 초기 렌더 ---
game.bg.draw(game.ctx);
game.cat.draw(game.ctx, false);
$("best-line").textContent = game.best ? `최고 기록 ${game.best} m` : "";
show("start");

// 테스트 훅
window.__game = game;
window.__audio = audio;
window.__sfx = sfx;
window.__music = music;
