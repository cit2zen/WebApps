// dialogs.js — 공통 모달(openDialog·closeTop·toast: 포커스 트랩·Esc 스택) + S5 설정 · S6 도움말 · S9 일시정지 · S9a 나가기 확인 (§4)
// 문자열은 dom.h/setText/fmt로 textContent에만 넣고, 스타일은 classList로만 바꾼다(§6 보안 규칙).
import S from './strings.js';
import { h, setText, fmt } from './dom.js';
import { load } from './storage.js';
import { daily, todayKST } from './daily.js';
import { drawStoneThumb, drawRockMini } from './render.js';
import { label } from './flags.js';

const FOCUS = 'button:not([disabled]),textarea,[tabindex="0"]';
const stack = [];                                          // [{id, el, opener}] — 마지막이 최상단
let cb = {};
export function mount(c) { cb = c; }
export const isOpen = () => stack.length > 0;
export const topId = () => (stack.length ? stack[stack.length - 1].id : null);

export function button(cls, text, fn, props = {}) {
  const b = h('button', { class: cls, type: 'button', ...props }, text);
  b.addEventListener('click', fn);
  return b;
}
// 🔊 버튼(S2·S9·S10 공통): 클릭 시점 저장값을 뒤집고, syncSound()가 [data-snd] 전부를 저장값에 맞춘다(M·S5·훅 mute 뒤)
const icon = () => (load().sound !== false ? '🔊' : '🔇');
export function syncSound() { for (const b of document.querySelectorAll('[data-snd]')) setText(b, icon()); }
export const soundButton = () => button('pol-btn-ghost pol-btn-icon', icon(), () => {
  if (cb.onSetting) cb.onSetting('sound', load().sound === false);
  syncSound();
}, { 'aria-label': S.lobby.sound, 'data-snd': '' });
export function shell(id, name) {
  const ov = h('div', { class: 'pol-overlay', id });
  const dl = h('div', { class: 'pol-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': name });
  ov.appendChild(dl);
  return [ov, dl];
}
function trap(e) {                                         // Tab을 최상단 대화상자 안에서 순환
  if (e.key !== 'Tab' || !stack.length) return;
  const f = [...stack[stack.length - 1].el.querySelectorAll(FOCUS)];
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  e.preventDefault();
  f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length].focus();
}
export function openDialog(el, opener) {
  (document.getElementById('dialogs') || document.body).appendChild(el);
  el.addEventListener('keydown', trap);
  stack.push({ id: el.id, el, opener: opener || null });
  const first = el.querySelector('[data-autofocus]') || el.querySelector(FOCUS);
  if (first) first.focus();
  return el;
}
function pop() {
  const d = stack.pop();
  d.el.remove();
  if (d.opener && d.opener.isConnected) d.opener.focus();  // 열었던 버튼으로 포커스 반환
}
// Esc 규칙(§4): 최상단 하나만 닫는다. 최상단이 S9면 닫지 않고 재개 콜백(main → game.resume → closePause)
export function closeTop() {
  if (!stack.length) return false;
  if (topId() === 'dlg-pause') { if (cb.onResume) cb.onResume(); return true; }
  pop();
  return true;
}
export function closeDialog(id) {                          // id와 그 위에 쌓인 것까지 닫는다
  const i = stack.findIndex(d => d.id === id);
  if (i < 0) return false;
  while (stack.length > i) pop();
  return true;
}
export const closePause = () => closeDialog('dlg-pause');
export function closeAll() { while (stack.length) pop(); }

// 지금 보이는 화면 루트(#game·#result·#lobby)에 붙인다. 인게임 위치는 play.css `#game .pol-toast`가 덮는다
export function toast(msg, ms = 2000) {
  const root = ['game', 'result', 'lobby'].map(id => document.getElementById(id)).find(r => r && !r.hidden) || document.body;
  const t = h('div', { class: 'pol-toast', role: 'status' }, msg);
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

// ── S5 설정: 소리·진동·손잡이(pol-seg) + 손가락 안내 다시 보기 + 닫기 ──
function seg(title, field, opts, cur, off) {
  const g = h('div', { class: 'pol-seg', role: 'group', 'aria-label': title });
  for (const [text, v] of opts) {
    const b = button('', text, () => {
      if (cb.onSetting) cb.onSetting(field, v);
      syncSound();
      for (const x of g.children) x.setAttribute('aria-pressed', String(x === b));
    }, { 'aria-pressed': String(v === cur) });
    b.disabled = !!off;
    g.appendChild(b);
  }
  const row = h('div', { class: 'set-row' });
  row.append(h('span', { class: 'set-label' }, title), g);
  return row;
}
export function openSettings(opener) {
  const st = load(), [ov, dl] = shell('dlg-settings', S.pause.settings), on = S.settings.on, off = S.settings.off;
  dl.append(
    seg(S.pause.sound, 'sound', [[on, true], [off, false]], st.sound !== false),
    seg(S.settings.vibe, 'vibe', [[on, true], [off, false]], st.vibe !== false, !('vibrate' in navigator)),
    seg(S.pause.hand, 'hand', [[S.pause.handRight, 'R'], [S.pause.handLeft, 'L']], st.hand || 'R'),
    button('pol-btn-ghost', S.settings.tutReset, () => { if (cb.onSetting) cb.onSetting('tutDone', false); toast(S.toast.tutReset); }),
    button('pol-btn-ghost', S.lobby.close, () => closeTop()));
  return openDialog(ov, opener);
}

// ── S6 도움말 3장(230×230 canvas, render.js 함수 + flags.label) ──
function paint(cv, page) {
  const W = 230, dpr = Math.min(window.devicePixelRatio || 1, 2), cs = getComputedStyle(document.documentElement);
  const tok = v => cs.getPropertyValue(v).trim(), set = daily(todayKST()), mono = `22px ${tok('--font-mono')}`;
  const probe = document.querySelector('.fs-probe'), hero = probe ? getComputedStyle(probe).fontSize : '64px';
  cv.width = cv.height = Math.round(W * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = tok('--doltap-sky-dawn'); ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = tok('--ink-warm');
  if (page === 0) {                                        // 너럭바위 · 매달린 납작돌 · 투영 점선 · 좌우 화살표
    drawRockMini(ctx, { x: 15, y: 178, w: 200, h: 48 });
    drawStoneThumb(ctx, set.stones[0], { x: 80, y: 40, w: 70, h: 50 });
    ctx.save(); ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.5; ctx.strokeStyle = tok('--ink-muted');
    ctx.beginPath(); ctx.moveTo(115, 94); ctx.lineTo(115, 176); ctx.stroke(); ctx.restore();
    label(ctx, '←', 36, 72, mono); label(ctx, '→', 176, 72, mono);
  } else if (page === 1) {                                 // 같은 모난돌 0° · 30° + ↺↻
    const a = set.stones.find(s => s.type === 'angular') || set.stones[0];
    drawStoneThumb(ctx, a, { x: 20, y: 70, w: 80, h: 80 });
    ctx.save(); ctx.translate(170, 110); ctx.rotate(Math.PI / 6); ctx.translate(-170, -110);
    drawStoneThumb(ctx, a, { x: 130, y: 70, w: 80, h: 80 }); ctx.restore();
    label(ctx, '↺', 48, 196, mono); label(ctx, '↻', 158, 196, mono);
  } else {                                                 // 촛불 3개(마지막 grayscale) · 돌 3개 탑 · 3
    for (let j = 0; j < 3; j++) {
      ctx.save(); if (j === 2) { ctx.globalAlpha = 0.3; ctx.filter = 'grayscale(1)'; }
      label(ctx, '🕯️', 16 + 30 * j, 40, mono); ctx.restore();
    }
    drawRockMini(ctx, { x: 10, y: 190, w: 140, h: 36 });
    set.stones.slice(0, 3).forEach((s, j) => drawStoneThumb(ctx, s, { x: 35, y: 148 - 40 * j, w: 90, h: 40 }));
    label(ctx, '3', 170, 150, `${hero} ${tok('--font-mono')}`);
  }
}
export function openHelp(opener) {
  const [ov, dl] = shell('dlg-help', S.pause.help), card = h('div', { class: 'pol-card help-card' });
  const photo = h('div', { class: 'pol-photo' }), cv = h('canvas', { 'aria-hidden': 'true' });
  const cap = h('p', { class: 'pol-caption' }), dots = h('div', { class: 'help-dots', 'aria-hidden': 'true' });
  const fine = window.matchMedia('(pointer:fine)').matches;
  let p = 0, x0 = null;
  const prev = button('pol-btn-ghost', S.helpNav.prev, () => go(p - 1));
  const next = button('pol-btn-ghost', S.helpNav.next, () => go(p + 1));
  function go(i) {
    p = Math.max(0, Math.min(2, i));
    paint(cv, p);
    setText(cap, fine ? `${S.help[p]}\n${S.helpKeys}` : S.help[p]);
    prev.disabled = p === 0; next.disabled = p === 2;
    [...dots.children].forEach((x, j) => x.classList.toggle('on', j === p));
  }
  for (let j = 0; j < 3; j++) dots.appendChild(h('span', { class: 'dot' }));
  photo.appendChild(cv); card.append(photo, cap);
  photo.addEventListener('pointerdown', e => { x0 = e.clientX; });
  photo.addEventListener('pointerup', e => {                // 스와이프 40px 이상
    if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(p + (e.clientX < x0 ? 1 : -1));
    x0 = null;
  });
  ov.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(p - 1); else if (e.key === 'ArrowRight') go(p + 1); });
  const nav = h('div', { class: 'help-nav' }); nav.append(prev, next);
  dl.append(card, dots, nav, button('pol-btn-ghost', S.lobby.close, () => closeTop()));
  go(0);                                                   // 이전 비활성 뒤에 열어야 첫 포커스가 다음/닫기로 간다
  return openDialog(ov, opener);
}

// ── S9 일시정지 · S9a 나가기 확인. openPause는 game.pause가 부른다 ──
export function openPause(info = {}) {
  closeDialog('dlg-pause');
  const [ov, dl] = shell('dlg-pause', S.pause.title);
  const snd = soundButton();
  const toLobby = button('pol-btn-ghost', S.pause.toLobby, () => {
    if (info.needConfirm) openLeave(toLobby); else if (cb.onLeave) cb.onLeave();
  });
  const row = h('div', { class: 'pause-row' });
  row.append(button('pol-btn-ghost', S.pause.help, e => openHelp(e.currentTarget)),
    button('pol-btn-ghost', S.pause.settings, e => openSettings(e.currentTarget)), snd);
  dl.append(h('h2', { class: 't-title' }, S.pause.title),
    h('p', { class: 'pause-status' }, fmt(S.pause.status, { H: (+info.H || 0).toFixed(1), placed: info.placed || 0 })),
    button('pol-btn-primary', S.pause.resume, () => { if (cb.onResume) cb.onResume(); }, { 'data-autofocus': '' }),
    row, toLobby);
  return openDialog(ov, null);
}
function openLeave(opener) {
  const [ov, dl] = shell('dlg-leave', S.pause.leaveWarn);
  dl.append(h('p', { class: 'danger' }, S.pause.leaveWarn),
    button('pol-btn-ghost', S.pause.leaveOk, () => { if (cb.onLeave) cb.onLeave(); }),
    button('pol-btn-primary', S.pause.leaveCancel, () => closeTop(), { 'data-autofocus': '' }));
  return openDialog(ov, opener);
}
