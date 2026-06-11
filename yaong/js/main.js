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
  const alive = Math.max(0, n);
  $("lives").textContent = "💗".repeat(alive) + "🤍".repeat(Math.max(0, 3 - n));
  // 이모지는 스크린리더가 개수를 못 읽으므로 aria-label로 수치 제공
  $("lives").setAttribute("aria-label", `생명 ${alive}개`);
};
game.onScoreChange = (s) => {
  $("score").textContent = `${s} m`;
};
game.onGameOver = (score, best) => {
  $("final-score").textContent = score;
  $("best-result").textContent = `최고 기록 ${best} m`;
  music.stop(); // 결과 화면에서 BGM 정지(배터리/오디오 점유 방지)
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
function startMeter(fillEl, thresholdEl, statusEl, failMsg = "⚠️ 마이크 권한을 허용해 주세요") {
  stopMeter();
  if (thresholdEl) thresholdEl.style.left = `${settings.threshold * 100}%`;
  const meterEl = fillEl.closest(".meter"); // role=meter 래퍼
  const tick = () => {
    const lv = audio.getLevel();
    const pct = Math.round(Math.min(100, lv * 100));
    fillEl.style.width = `${pct}%`;
    if (meterEl) meterEl.setAttribute("aria-valuenow", String(pct));
    meterRaf = requestAnimationFrame(tick);
  };
  tick();
  ensureMic().then((ok) => {
    if (statusEl) statusEl.textContent = ok ? "" : failMsg;
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
  startMeter($("ready-meter-fill"), $("ready-meter-threshold"), $("ready-mic-status"),
    "마이크 없이는 탭/스페이스로 점프!");
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
  else if (returnFrom === "gameover") show("gameover");
  else goHome();
}

// --- 마이크 폴백: 탭/스페이스 보조 점프(고정 세기) ---
const TAP_JUMP_POWER = 0.6;
function manualJump() {
  if (game.state !== "playing" || !game.cat.onGround) return;
  game.cat.jump(TAP_JUMP_POWER);
  sfx.jump();
}
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || game.state !== "playing") return;
  e.preventDefault(); // 스크롤·포커스 버튼 재클릭 방지
  manualJump();
});
canvas.addEventListener("pointerdown", manualJump);

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

// 탭 비활성/백그라운드에서는 BGM 스케줄러를 멈추고, 복귀 시 재개
// (배경에서 노트 예약·배터리 점유 방지). 게임 플레이 중일 때만 자동 재개.
let _musicWasPlaying = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    _musicWasPlaying = music.playing;
    music.stop();
  } else if (_musicWasPlaying && game.state === "playing") {
    music.start();
  }
});

// 테스트 훅
window.__game = game;
window.__audio = audio;
window.__sfx = sfx;
window.__music = music;
