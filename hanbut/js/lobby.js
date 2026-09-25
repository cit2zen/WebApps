// lobby.js — 로비(idle): 이어하기·팩 카드(cascade↔pyramid)·레벨 칩·기록 줄 + 도움말/설정 시트 + 진행 초기화 2탭
import { setText, setRaw, PACK_CAPTIONS } from './strings.js';
import * as render from './render.js';
import { el, ensure, cssVar, setStars, openOverlay, closeOverlay, REDUCED_UI } from './cards.js';

const $ = (id) => document.getElementById(id);
let dispatch = () => false;
let store = null;
let levels = [];
let onWipe = null;
let selected = 1;            // 선택된 팩 k
let openSheet = null;        // 열린 시트 요소(#help | #settings) | null
let wipeArmed = false, wipeTimer = 0, wipeText = '';

const prog = () => store.loadProgress();
const packCount = () => Math.ceil(levels.length / 10);
const packOf = (L) => Math.ceil(L / 10);
const isDesktop = () => typeof matchMedia === 'function' && matchMedia('(min-width: 641px)').matches;
const shake = (e) => e && e.animate && !REDUCED_UI && e.animate([{ transform: 'translateX(0)' },
  { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 120 });
const packScore = (p, k) => { let s = 0; for (let L = 10 * k - 9; L <= 10 * k; L++) s += p.stars[L] | 0; return s; };
const enter = (L) => dispatch({ type: 'enter', L });

// main.js: lobby.init({ dispatch, store, levels }) — onWipe(선택): wipe 후 game 메모리 진행 교체용 훅
export function init(opts) {
  dispatch = opts.dispatch; store = opts.store; onWipe = opts.onWipe || null;
  levels = Array.isArray(opts.levels) ? opts.levels : (opts.levels && opts.levels.levels) || [];
  const m = prog().maxClearedLevel;
  selected = Math.max(1, Math.min(packCount() || 1, packOf(Math.min(m + 1, levels.length || 1))));

  const cont = $('btn-continue');
  if (cont) cont.addEventListener('click', () => { const mm = prog().maxClearedLevel; enter(mm >= levels.length ? 1 : mm + 1); });
  const help = $('help'), settings = $('settings');
  if ($('btn-help')) $('btn-help').addEventListener('click', () => openSheetEl(help));
  if ($('btn-settings')) $('btn-settings').addEventListener('click', () => openSheetEl(settings));
  if ($('btn-help-close')) $('btn-help-close').addEventListener('click', closeSheet);
  if ($('btn-settings-close')) $('btn-settings-close').addEventListener('click', closeSheet);
  for (const o of [help, settings]) if (o) o.addEventListener('pointerdown', (e) => { if (e.target === o) closeSheet(); });   // 바깥 탭
  document.addEventListener('keydown', (e) => {                  // 시트 열림 중 Escape = 닫기(keys.js 도달 전)
    if (openSheet && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); }
  }, { capture: true });

  for (const [id, key] of [['tg-sound', 'sound'], ['tg-vibe', 'vibrate']]) {
    const b = $(id);
    if (b) b.addEventListener('click', () => {
      const s = store.loadSettings(); s[key] = !s[key]; store.saveSettings(s); syncToggles(s);
      document.dispatchEvent(new CustomEvent('hanbut:settings', { detail: s }));   // audio 마스터 게인 갱신용
    });
  }
  const wb = $('btn-wipe');
  if (wb) {
    wipeText = wb.textContent;
    wb.addEventListener('click', () => {
      clearTimeout(wipeTimer);
      if (!wipeArmed) { setWipeLabel(true); wipeTimer = setTimeout(() => setWipeLabel(false), 3000); }   // §6 허용 3s
      else { setWipeLabel(false); wipe(); }
    });
  }
  syncToggles(store.loadSettings());
}

// ── 렌더 ──
export function renderLobby() { renderContinue(); renderPackCards(); renderChips(selected); renderBest(); }
export function renderContinue() {
  const b = $('btn-continue');
  if (!b) return;
  const m = prog().maxClearedLevel;
  if (m <= 0) setText(b, 'start');
  else if (m < levels.length) setText(b, 'contAt', { n: m + 1 });
  else setText(b, 'again');
}
export function renderBest() {
  const b = $('best');
  if (!b) return;
  const n = prog().bestStreak;
  b.hidden = !(n >= 1);
  if (n >= 1) setText(b, 'bestStreak', { n });
}
export function renderPackCards() {
  const g = $('packs');
  if (!g) return;
  const p = prog();
  g.replaceChildren();
  for (let k = 1; k <= packCount(); k++) {
    const locked = 10 * k - 9 > p.maxClearedLevel + 1;
    const card = el('div', 'pol-card');
    card.dataset.pack = String(k); card.setAttribute('role', 'button'); card.tabIndex = 0;
    if (locked) { card.classList.add('is-locked'); card.setAttribute('aria-disabled', 'true'); }
    if (k === selected && g.classList.contains('open')) card.classList.add('is-selected');
    const photo = el('div', 'pol-photo'), cv = photo.appendChild(el('canvas', ''));
    if (typeof PACK_CAPTIONS[k - 1] === 'string') setRaw(photo.appendChild(el('span', 't-caption pack-cap')), PACK_CAPTIONS[k - 1]);
    card.appendChild(photo);
    setText(card.appendChild(el('div', 'pol-num')), 'polNumPack', { nn: String(k).padStart(2, '0') });
    const cap = card.appendChild(el('div', 'pol-caption'));
    if (locked) setText(cap, 'packLocked');
    else setText(cap, 'packScore', { s: packScore(p, k) });
    card.addEventListener('click', () => onPackTap(k, card, locked));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    g.appendChild(card);
    drawPackPhoto(cv, k, p, locked);
  }
}
function onPackTap(k, card, locked) {
  if (locked) { shake(card); return; }                           // 규칙 13
  const g = $('packs');
  if (g.classList.contains('open') && k === selected) g.classList.remove('open');
  else { selected = k; g.classList.add('open'); }
  for (const c of g.children) c.classList.toggle('is-selected', g.classList.contains('open') && c.dataset.pack === String(selected));
  renderChips(selected);
}
function drawPackPhoto(cv, k, p, locked) {
  const size = isDesktop() ? 160 : 96;
  cv.width = size * 2; cv.height = size * 2;
  const ctx = cv.getContext('2d');
  const last = levels[10 * k - 1];
  if (!locked && p.maxClearedLevel >= 10 * k && last && render.drawStatic) {   // 팩 완료 = L(10k) sol 잉크
    render.drawStatic(cv, last, last.sol, size); return;
  }
  ctx.setTransform(2 * size / 96, 0, 0, 2 * size / 96, 0, 0);   // 96 기준 좌표계
  if (locked) {
    ctx.globalAlpha = 0.5; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '36px sans-serif'; ctx.fillText('🔒', 48, 50); ctx.globalAlpha = 1; return;
  }
  const on = cssVar('--gold-mid'), off = cssVar('--cream-400');
  for (let i = 0; i < 10; i++) {                                 // 5×2 점, 지름 12·gap 8 → 92×32 중앙
    const x = 2 + (i % 5) * 20 + 6, y = 32 + Math.floor(i / 5) * 20 + 6;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    if (p.stars[10 * k - 9 + i] > 0) { ctx.fillStyle = on; ctx.fill(); }
    else { ctx.strokeStyle = off; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
}
export function renderChips(k) {
  const panel = $('lvl-panel');
  if (!panel) return;
  const g = $('packs');
  panel.hidden = !(g && g.classList.contains('open'));
  panel.replaceChildren();
  const p = prog();
  for (let L = 10 * k - 9; L <= Math.min(10 * k, levels.length); L++) {
    const chip = el('button', 'chip');
    chip.type = 'button'; chip.dataset.level = String(L);
    const active = L <= p.maxClearedLevel + 1;
    if (!active) { chip.classList.add('is-locked'); chip.setAttribute('aria-disabled', 'true'); }
    setText(chip.appendChild(el('span', 'chip-num')), 'level', { n: L });
    const st = chip.appendChild(el('span', 'chip-stars'));
    if ((p.stars[L] | 0) > 0) setStars(st, p.stars[L]); else setRaw(st, '·');
    chip.addEventListener('click', () => (active ? enter(L) : shake(chip)));
    panel.appendChild(chip);
  }
}
export function setWipeLabel(confirm) {
  const b = $('btn-wipe');
  wipeArmed = !!confirm;
  if (!b) return;
  if (confirm) setText(b, 'wipeConfirm'); else setRaw(b, wipeText);
}
export function syncToggles(s) {
  for (const [id, key] of [['tg-sound', 'sound'], ['tg-vibe', 'vibrate']]) {
    const b = $(id);
    if (b) { b.setAttribute('aria-pressed', String(!!s[key])); b.classList.toggle('on', !!s[key]); }
  }
}
// 설정 '진행 초기화' 2탭과 __hanbut.wipe()가 같은 함수
export function wipe() {
  store.wipe();
  if (onWipe) onWipe(store.loadProgress());
  selected = 1;
  const g = $('packs'); if (g) g.classList.remove('open');
  renderLobby();
}

// ── 시트(도움말·설정) ──
function openSheetEl(o) {
  if (!o || openSheet) return;
  openSheet = o;
  for (const id of ['packs', 'lvl-panel', 'btn-continue']) if ($(id)) $(id).style.pointerEvents = 'none';
  if (o.id === 'help') drawHelpCard(o);
  openOverlay(o);
  const close = o.querySelector('#btn-help-close, #btn-settings-close');
  if (close) close.focus({ preventScroll: true });
}
export function closeSheet() {
  if (!openSheet) return;
  const o = openSheet; openSheet = null;
  for (const id of ['packs', 'lvl-panel', 'btn-continue']) if ($(id)) $(id).style.pointerEvents = '';
  if (o.id === 'settings') setWipeLabel(false);
  closeOverlay(o);
}
export function sheetOpen() { return openSheet !== null; }
function drawHelpCard(o) {
  const L1 = levels[0]; if (!L1 || !render.drawStatic) return;
  const card = o.querySelector('.pol-card') || o;
  const photo = ensure(card, '.pol-photo', 'div', 'pol-photo', card.firstChild);
  const cv = ensure(photo, 'canvas', 'canvas', '');
  cv.width = 320; cv.height = 320;
  render.drawStatic(cv, L1, L1.sol, 160);
}
