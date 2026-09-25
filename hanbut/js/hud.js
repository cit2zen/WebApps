// hud.js — 인게임 크롬: #topbar(⏸·#lvl-label·#streak) · #remain · #toast · #btn-reset 롱프레스 · #btn-hint · #overlay-pause
// 타이밍: 토스트 만료·배지 축소는 clock.t(내부 시계), 롱프레스 held만 performance.now() 벽시계.
import { setText, setRaw } from './strings.js';
import { el, openOverlay, closeOverlay, REDUCED_UI } from './cards.js';
import * as store from './store.js';

const RING_CSS = typeof CSS !== 'undefined' && 'registerProperty' in CSS;
const HOLD_MS = 600;
const $ = (id) => document.getElementById(id);

let dispatch = () => false;
let clock = { t: 0, speed: 1 };
let E = {};                       // 요소 캐시
let remainCap = null, remainNum = null;
let toastUntil = 0;
let badgeHideAt = 0, badgeShown = false;
let hold = null;                  // { id, downAt, fired }
let tipTimer = 0;

const anim = (e, frames, ms) => { if (e && e.animate && !REDUCED_UI) e.animate(frames, { duration: ms, easing: 'ease-out' }); };
const label = (btn) => (btn && btn.querySelector('.label')) || btn;

export function init(opts) {
  dispatch = opts.dispatch;
  if (opts.clock) clock = opts.clock;
  for (const id of ['play', 'btn-pause', 'lvl-label', 'streak', 'remain', 'toast', 'btn-reset', 'btn-hint',
    'board', 'overlay-pause', 'btn-resume', 'btn-lobby', 'tg-sound-p', 'tg-vibe-p']) E[id] = $(id);

  // #remain = 캡션 '남음' + 숫자(2요소). 골격에 자식 2개가 없으면 만든다.
  const r = E.remain;
  if (r) {
    if (r.children.length >= 2) { remainCap = r.firstElementChild; remainNum = r.lastElementChild; }
    else { r.replaceChildren(); remainCap = el('span', 'remain-cap'); remainNum = el('span', 'remain-num'); r.append(remainCap, remainNum); }
    setText(remainCap, 'remainLabel');
  }
  setResetLabel(false);
  if (E['btn-hint']) setText(label(E['btn-hint']), 'hint');
  if (E['btn-resume']) setText(E['btn-resume'], 'resume');
  if (E['btn-lobby']) setText(E['btn-lobby'], 'lobby');

  // 크롬 버튼 3개: pointerdown preventDefault(포커스 획득 차단, click 유지)
  for (const id of ['btn-pause', 'btn-reset', 'btn-hint']) if (E[id]) E[id].addEventListener('pointerdown', (e) => e.preventDefault());
  if (E['btn-pause']) E['btn-pause'].addEventListener('click', () => dispatch({ type: 'pause' }));
  if (E['btn-hint']) E['btn-hint'].addEventListener('click', () => dispatch({ type: 'hint' }));
  initReset(E['btn-reset']);

  const ov = E['overlay-pause'];
  if (ov) ov.addEventListener('pointerdown', (e) => { if (e.target === ov) dispatch({ type: 'resume' }); });
  if (E['btn-resume']) E['btn-resume'].addEventListener('click', (e) => { e.stopPropagation(); dispatch({ type: 'resume' }); });
  if (E['btn-lobby']) E['btn-lobby'].addEventListener('click', (e) => { e.stopPropagation(); dispatch({ type: 'lobby' }); });
  for (const [id, key] of [['tg-sound-p', 'sound'], ['tg-vibe-p', 'vibrate']]) {
    const b = E[id];
    if (!b) continue;
    b.addEventListener('click', (e) => {
      e.stopPropagation(); const s = store.loadSettings(); s[key] = !s[key]; store.saveSettings(s); syncToggles(s);
      document.dispatchEvent(new CustomEvent('hanbut:settings', { detail: s }));
    });
  }
  syncToggles(store.loadSettings());
}

// ── 롱프레스 리셋 ──
function setP(btn, p, ms) {
  if (RING_CSS) btn.style.transitionDuration = ms + 'ms';
  btn.style.setProperty('--p', String(p));
}
function initReset(btn) {
  if (!btn) return;
  if (!RING_CSS) btn.style.transition = 'none';
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0 || hold) return;
    try { btn.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 */ }
    hold = { id: e.pointerId, downAt: performance.now(), fired: false };
    if (RING_CSS) setP(btn, 1, HOLD_MS);
  });
  const cancel = (tap) => {
    if (!hold) return;
    const fired = hold.fired; hold = null;
    setP(btn, 0, 150);                                   // 링 150ms 되감김(폴백은 즉시 0)
    if (tap && !fired) showResetTip();
  };
  btn.addEventListener('pointerup', (e) => { if (hold && e.pointerId === hold.id) cancel(true); });
  btn.addEventListener('pointercancel', (e) => { if (hold && e.pointerId === hold.id) cancel(false); });
  btn.addEventListener('pointermove', (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    const { left: l, right: r, top: t, bottom: b } = btn.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    if (x < l || x > r || y < t || y > b) cancel(false);
  });
}
function showResetTip() {
  setResetLabel(true); clearTimeout(tipTimer);
  tipTimer = setTimeout(() => setResetLabel(false), 1000);   // §6 허용: 리셋 툴팁 1s
}
export function setResetLabel(tip) {
  const b = E['btn-reset'];
  if (b) setText(label(b), tip ? 'resetTip' : 'reset');
}

// ── 표시 API ──
export function setRemain(k) { if (remainNum) setRaw(remainNum, k); }
export function shakeRemain() {
  anim(E.remain, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
    { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-6px)' },
    { transform: 'translateX(0)' }], 600);
}
export function setLevelLabel(k, L) { if (E['lvl-label']) setText(E['lvl-label'], 'lvlLabel', { k, n: L }); }
export function setStreak(n) {
  const b = E.streak;
  if (!b) return;
  if (n >= 2) {
    setText(b, 'streak', { n });
    b.hidden = false; b.style.transform = ''; badgeShown = true; badgeHideAt = 0;
    anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], 200);
  } else if (badgeShown) {
    badgeShown = false;
    anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(0)' }], 200);
    b.style.transform = REDUCED_UI ? '' : 'scale(0)';
    badgeHideAt = clock.t + 200;                         // tick이 축소 종료 후 제거
  } else b.hidden = true;
}
export function showToast(key, obj) {
  const t = E.toast;
  if (!t) return;
  setText(t, key, obj); t.style.visibility = 'visible';
  toastUntil = clock.t + 3000;
}
export function hideToast() { if (E.toast) E.toast.style.visibility = 'hidden'; toastUntil = 0; }
export function showHintButton() {
  const h = E['btn-hint'];
  if (!h || h.style.visibility === 'visible') return;
  h.style.visibility = 'visible';
  anim(h, [{ opacity: 0 }, { opacity: 1 }], 300);
}
export function hideHintButton() { if (E['btn-hint']) E['btn-hint'].style.visibility = 'hidden'; }

// 최초 L1(maxClearedLevel == 0 && L == 1) 첫 push 전: ⏸만 표시. on=false면 전부 표시(재플레이).
export function setFirstRun(on) {
  for (const id of ['lvl-label', 'remain', 'btn-reset']) if (E[id]) E[id].style.visibility = on ? 'hidden' : 'visible';
  hideHintButton();
}
// 첫 push: #lvl-label·#remain·#btn-reset 동시 300ms 페이드 인
export function revealChrome() {
  for (const id of ['lvl-label', 'remain', 'btn-reset']) {
    const e = E[id];
    if (!e || e.style.visibility !== 'hidden') continue;
    e.style.visibility = 'visible';
    anim(e, [{ opacity: 0 }, { opacity: 1 }], 300);
  }
}
// level_in 슬라이드 300ms: 'r' = 오른쪽→중앙, 'l' = 왼쪽→중앙 (play.css .slide-in-r/.slide-in-l)
export function slideIn(dir) {
  const b = E.board;
  if (!b) return;
  b.classList.remove('slide-in-r', 'slide-in-l');
  void b.offsetWidth;                                    // 키프레임 재시작
  b.classList.add(dir === 'l' ? 'slide-in-l' : 'slide-in-r');
}

// ── 일시정지 오버레이(수동/자동 변형 — 자동은 제목 대신 '탭하여 계속') ──
export function showPause(auto) {
  const ov = E['overlay-pause'];
  if (!ov) return;
  const title = ov.querySelector('#pause-title, .pause-title, h2')
    || ov.insertBefore(el('p', 'pause-title'), ov.firstChild);
  setText(title, auto ? 'tapToContinue' : 'paused');
  syncToggles(store.loadSettings());
  openOverlay(ov);
}
export function hidePause() { closeOverlay(E['overlay-pause']); }
export function syncToggles(s) {
  for (const [id, key] of [['tg-sound-p', 'sound'], ['tg-vibe-p', 'vibrate']]) {
    const b = E[id];
    if (!b) continue;
    b.setAttribute('aria-pressed', String(!!s[key]));
    b.classList.toggle('on', !!s[key]);
  }
}

// ── 프레임 틱(main.js rAF) ──
export function tick(dt) {
  const btn = E['btn-reset'];
  if (hold && !hold.fired && btn) {
    const held = performance.now() - hold.downAt;        // 실시간, clock/speed 무관
    if (!RING_CSS) btn.style.setProperty('--p', String(Math.min(1, held / HOLD_MS)));
    if (held >= HOLD_MS) {
      hold.fired = true;
      dispatch({ type: 'reset' });
      if (RING_CSS) btn.style.transitionDuration = '0ms';
      btn.style.setProperty('--p', '0');
    }
  }
  if (toastUntil && clock.t >= toastUntil) hideToast();
  if (badgeHideAt && clock.t >= badgeHideAt) {
    badgeHideAt = 0;
    if (E.streak && !badgeShown) { E.streak.hidden = true; E.streak.style.transform = ''; }
  }
  return dt;
}
