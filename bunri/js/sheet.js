// 공용 대화상자(바텀시트) + 비차단 토스트
import { $, el } from './dom.js';

const overlay = $('#overlay');
const box = $('#dialog');
const toastEl = $('#toast');
let resolver = null;
let dismissValue = null;
let lastFocus = null;
let toastTimer = 0;

export const dialogOpen = () => !overlay.hidden;

function close(value) {
  if (!resolver) return;
  const r = resolver;
  resolver = null;
  overlay.hidden = true;
  box.replaceChildren();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  r(value);
}

/**
 * nodes: 본문 노드 배열 · buttons: [{label, value, primary}]
 * dismiss: Esc/바깥 클릭 시 돌려줄 값(undefined면 바깥 클릭 무시, Esc는 null)
 */
export function openDialog(nodes, buttons, { dismiss, label } = {}) {
  if (resolver) close(dismissValue);
  dismissValue = dismiss === undefined ? null : dismiss;
  overlay.dataset.backdrop = dismiss === undefined ? 'off' : 'on';
  lastFocus = document.activeElement;
  const actions = el('div', { class: 'dlg-actions' }, buttons.map((b) => el('button', {
    type: 'button',
    class: b.primary ? 'btn btn-primary' : 'btn',
    text: b.label,
    on: { click: () => close(b.value) },
  })));
  box.replaceChildren(...nodes.filter(Boolean), actions);
  box.setAttribute('aria-label', label || '안내');
  overlay.hidden = false;
  box.scrollTop = 0;
  const focusBtn = actions.querySelector('.btn-primary') || actions.querySelector('button');
  if (focusBtn) focusBtn.focus({ preventScroll: true });
  return new Promise((res) => { resolver = res; });
}

overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(dismissValue); }
  if (e.key === 'Tab') { // 간단한 포커스 가두기
    const f = [...box.querySelectorAll('button, a[href], input')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
overlay.addEventListener('click', (e) => {
  if (e.target === overlay && overlay.dataset.backdrop === 'on') close(dismissValue);
});

export function confirmDialog(title, body, okLabel, cancelLabel) {
  return openDialog([
    el('h2', { class: 'sheet-title', text: title }),
    body ? el('p', { class: 'sheet-why', text: body }) : null,
  ], [
    { label: cancelLabel, value: false },
    { label: okLabel, value: true, primary: true },
  ], { dismiss: false, label: title });
}

/** 비차단 토스트 — lines[0] 굵게, 나머지 작은 줄 */
export function toast(lines, ms = 1500) {
  clearTimeout(toastTimer);
  const list = [].concat(lines).filter(Boolean);
  toastEl.replaceChildren(...list.map((t, i) => el('span', { class: i ? 'toast-sub' : 'toast-main', text: t })));
  toastEl.hidden = true;
  void toastEl.offsetWidth;
  toastEl.hidden = false;
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

export function hideToast() {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
}
