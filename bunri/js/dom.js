// DOM 헬퍼 — innerHTML 없이 createElement + textContent만 사용
import { emit } from './events.js';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

const SCREENS = ['lobby', 'stages', 'play', 'result', 'dex', 'stickers'];

export function showScreen(id) {
  for (const s of SCREENS) {
    const n = $('#' + s);
    if (n) n.hidden = s !== id;
  }
  document.body.dataset.screen = id;
  document.body.classList.toggle('is-playing', id === 'play');
  window.scrollTo(0, 0);
  emit('screen', { name: id });
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 클래스 애니메이션 재생 — animationend에서 제거 */
export function flash(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  node.addEventListener('animationend', () => node.classList.remove(cls), { once: true });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
