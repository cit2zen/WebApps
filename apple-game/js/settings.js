// 작은 설정 창: 보드 테마 / 효과음 볼륨 / 배경음악 볼륨·켜기.
import { setSfxVolume, setBgmVolume, unlock } from "./audio.js";
import { startBgm } from "./bgm.js";

const KEY = "apple-settings";
const THEMES = [
  { id: "orchard", label: "과수원" },
  { id: "night", label: "야간" },
  { id: "sunset", label: "노을" },
  { id: "mono", label: "모노" },
];
const DEFAULTS = { theme: "orchard", sfx: 60, bgm: 35 };

// 0~100 숫자로 강제(숫자가 아니면 기본값) — localStorage 값은 신뢰하지 않는다.
function clampPct(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

function load() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { stored = {}; }
  const s = { ...DEFAULTS, ...stored };
  s.sfx = clampPct(s.sfx, DEFAULTS.sfx);
  s.bgm = clampPct(s.bgm, DEFAULTS.bgm);
  if (!THEMES.some((t) => t.id === s.theme)) s.theme = DEFAULTS.theme; // 테마 화이트리스트
  return s;
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function initSettings() {
  const s = load();
  document.body.dataset.theme = s.theme;
  setSfxVolume(s.sfx / 100);
  setBgmVolume(s.bgm / 100);

  document.body.insertAdjacentHTML("beforeend", `
    <button class="gear" id="gear" aria-label="설정">⚙</button>
    <div class="panel" id="panel" hidden>
      <h3>설정</h3>
      <div class="panel__group">
        <label>보드 테마</label>
        <div class="swatches">
          ${THEMES.map((t) => `<button class="sw sw--${t.id}" data-theme="${t.id}">${t.label}</button>`).join("")}
        </div>
      </div>
      <div class="panel__group">
        <label>효과음 <span id="sfxVal">${s.sfx}</span></label>
        <input type="range" id="sfxRange" min="0" max="100" value="${s.sfx}" />
      </div>
      <div class="panel__group">
        <label>배경음악</label>
        <input type="range" id="bgmRange" min="0" max="100" value="${s.bgm}" />
      </div>
    </div>
  `);

  const $ = (id) => document.getElementById(id);
  const panel = $("panel");
  const syncTheme = () => panel.querySelectorAll(".sw").forEach((b) =>
    b.classList.toggle("active", b.dataset.theme === s.theme));
  syncTheme();

  $("gear").addEventListener("click", () => { panel.hidden = !panel.hidden; });

  panel.querySelectorAll(".sw").forEach((b) =>
    b.addEventListener("click", () => {
      s.theme = b.dataset.theme;
      document.body.dataset.theme = s.theme;
      syncTheme(); save(s);
    }));

  $("sfxRange").addEventListener("input", (e) => {
    s.sfx = +e.target.value; $("sfxVal").textContent = s.sfx;
    setSfxVolume(s.sfx / 100); save(s);
  });
  $("bgmRange").addEventListener("input", (e) => {
    s.bgm = +e.target.value; setBgmVolume(s.bgm / 100); save(s);
  });

  // 첫 사용자 입력에서 오디오 해제 + 배경음악 시작.
  const kick = () => {
    unlock();
    startBgm();
    window.removeEventListener("pointerdown", kick);
  };
  window.addEventListener("pointerdown", kick);
}
