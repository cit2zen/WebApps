// cards.js — 결과 카드(#result, 정지 카드 변형 포함)·팩 완료 카드(#packdone) + 공용 DOM 헬퍼
// 텍스트는 strings.js setText/setRaw 단일 경로. 타이머는 오버레이 transitionend 폴백 110ms만.
import { setText, setRaw } from './strings.js';
import * as render from './render.js';

export const REDUCED_UI = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 공용 헬퍼(lobby·hud도 import) ──
export function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) for (const c of cls.split(' ')) if (c) e.classList.add(c);
  return e;
}
// parent 안에서 sel을 찾고 없으면 el(tag, cls)로 만들어 붙인다(HTML 골격 차이 흡수)
export function ensure(parent, sel, tag, cls, before = null) {
  let e = parent.querySelector(sel);
  if (!e) { e = el(tag, cls); parent.insertBefore(e, before); }
  return e;
}
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export function setStars(e, s) {
  const n = Math.max(0, Math.min(3, s | 0));
  setRaw(e, '★'.repeat(n) + '☆'.repeat(3 - n));
}
// 오버레이 열림: hidden 제거 → 다음 프레임 .in(150ms) / 닫힘: .in 제거(100ms) → transitionend(폴백 110ms) → hidden
export function openOverlay(o) {
  if (!o) return;
  o._closing = 0;
  o.hidden = false;
  if (REDUCED_UI) { o.classList.add('in'); return; }
  requestAnimationFrame(() => { if (!o.hidden) o.classList.add('in'); });
}
export function closeOverlay(o) {
  if (!o || o.hidden) return;
  o.classList.remove('in');
  if (REDUCED_UI) { o.hidden = true; return; }
  const token = (o._closing = (o._closing || 0) + 1);
  const done = () => {
    o.removeEventListener('transitionend', done);
    if (o._closing === token && !o.classList.contains('in')) o.hidden = true;
  };
  o.addEventListener('transitionend', done);
  setTimeout(done, 110);                                  // §6 허용 3건 중 오버레이 폴백
}

// ── 모듈 상태 ──
let dispatch = () => false;
let levels = [];
let resultEl, packEl;
let isPauseCard = false;

const nn = (x) => String(x).padStart(2, '0');
const levelOf = (L) => levels[L - 1] || levels.find(l => l && l.L === L) || null;

function photoCanvas(card, px) {
  const photo = ensure(card, '.pol-photo', 'div', 'pol-photo', card.firstChild);
  const cv = ensure(photo, 'canvas', 'canvas', '');
  cv.width = px * 2; cv.height = px * 2;
  return cv;
}

// main.js: cards.init({ dispatch }) — INTERFACE ASSUMPTION: levels(배열)를 함께 주면 w×h·팩 사진에 사용
export function init(opts) {
  dispatch = opts.dispatch;
  if (opts.levels) setLevels(opts.levels);
  resultEl = document.getElementById('result');
  packEl = document.getElementById('packdone');
  if (resultEl) {
    resultEl.addEventListener('pointerdown', (e) => {
      if (!(e.isPrimary && e.button === 0)) return;
      if (isPauseCard) return;                            // 정지 카드: 아무 곳 탭 스킵 비활성, 버튼만
      dispatch({ type: 'skip' });
    });
  }
  const go = document.getElementById('btn-go');
  const home = document.getElementById('btn-home');
  for (const [b, type] of [[go, 'next'], [home, 'lobby']]) {
    if (!b) continue;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); dispatch({ type }); });
  }
  if (go) setText(go, 'cont');
  if (home) setText(home, 'lobby');
}
export function setLevels(lv) { levels = Array.isArray(lv) ? lv : (lv && lv.levels) || []; }

// res = { L, stars, u, streak, hintUsed, pauseCard, packEnd } (game 'result' 이벤트 페이로드)
export function fillResult(res) {
  if (!resultEl) return;
  isPauseCard = !!res.pauseCard;
  const card = ensure(resultEl, '.pol-card', 'div', 'pol-card', resultEl.firstChild);
  const cv = photoCanvas(card, 160);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = cssVar('--cream-200');
  ctx.fillRect(0, 0, cv.width, cv.height);
  const snap = render.snapshot && render.snapshot();
  if (snap) ctx.drawImage(snap, 0, 0, cv.width, cv.height);
  const num = ensure(card, '.pol-num', 'div', 'pol-num');
  const lv = levelOf(res.L);
  if (lv) setText(num, 'polNumLevel', { nn: nn(res.L), w: lv.w, h: lv.h });
  else setText(num, 'level', { n: res.L });
  const cap = ensure(card, '.pol-caption', 'div', 'pol-caption t-title');
  setStars(cap, res.stars);
  const sub = ensure(card, '.result-sub', 'div', 'result-sub t-caption');
  if (res.hintUsed) setText(sub, 'hintUsed'); else setText(sub, 'rewinds', { u: res.u });

  const badge = document.getElementById('result-streak');
  if (badge) {
    badge.hidden = !(res.streak >= 2);
    if (res.streak >= 2) setText(badge, 'streak', { n: res.streak });
  }
  const next = ensure(resultEl, '.result-next', 'p', 'result-next t-caption');
  setText(next, 'next');
  next.hidden = isPauseCard;
  const go = document.getElementById('btn-go');
  const row = go && go.parentElement !== resultEl ? go.parentElement : null;
  for (const b of [row, go, document.getElementById('btn-home')]) if (b) b.hidden = !isPauseCard;
  openOverlay(resultEl);
}
export function hideResult() { isPauseCard = false; closeOverlay(resultEl); }

// 팩 완료 카드: 사진 '현상' 0–850ms 페이드 인(--cream-200 → L(10k) sol 잉크), #pack-stars 10셀
export function fillPackDone(k, progress) {
  if (!packEl) return;
  const card = ensure(packEl, '.pol-card', 'div', 'pol-card', packEl.firstChild);
  const cv = photoCanvas(card, 160);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = cssVar('--cream-200');
  ctx.fillRect(0, 0, cv.width, cv.height);
  const photo = cv.parentElement;
  const ink = ensure(photo, 'canvas.develop', 'canvas', 'develop');
  ink.width = cv.width; ink.height = cv.height;
  ink.style.position = 'absolute'; ink.style.inset = '0';
  if (!photo.style.position) photo.style.position = 'relative';
  const lv = levelOf(10 * k);
  if (lv && render.drawStatic) render.drawStatic(ink, lv, lv.sol, 160);
  if (!REDUCED_UI && ink.animate) ink.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 850, fill: 'both' });
  else ink.style.opacity = '1';

  setText(ensure(card, '.pol-num', 'div', 'pol-num'), 'polNumPack', { nn: nn(k) });
  const stars = (progress && progress.stars) || [];
  let s = 0;
  for (let L = 10 * k - 9; L <= 10 * k; L++) s += stars[L] | 0;
  setText(ensure(card, '.pol-caption', 'div', 'pol-caption'), 'packDoneCaption', { k, s });
  const title = ensure(packEl, '.packdone-title', 'p', 'packdone-title t-title', packEl.firstChild);
  setText(title, 'packDone', { k });

  const grid = document.getElementById('pack-stars') || ensure(card, '#pack-stars', 'div', '');
  if (!grid.id) grid.id = 'pack-stars';
  grid.replaceChildren();
  for (let L = 10 * k - 9; L <= 10 * k; L++) {
    const c = el('span', 'pack-star');
    setStars(c, stars[L] | 0);
    grid.appendChild(c);
  }
  openOverlay(packEl);
}

// packShutter{k} (850ms): 사진 확정 + 카드 흔들림 ±3° 350ms (찰칵 음은 main이 audio.shutter())
export function revealPhoto(k) {
  if (!packEl) return;
  const ink = packEl.querySelector('canvas.develop');
  if (ink) {
    if (ink.getAnimations) for (const a of ink.getAnimations()) a.finish();
    ink.style.opacity = '1';
  }
  const card = packEl.querySelector('.pol-card');
  if (card && !REDUCED_UI && card.animate) {
    card.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' },
      { transform: 'rotate(-2deg)' }, { transform: 'rotate(0)' }], { duration: 350, easing: 'ease-out' });
  }
  return k;
}
export function hidePackDone() { closeOverlay(packEl); }
