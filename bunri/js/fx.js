// 시각 효과 — 입자, 떠오르는 글자, 화면 흔들림, 색종이, 숫자 올리기
import { el, flash, reducedMotion } from './dom.js';

const layer = () => document.getElementById('fx');
const BIN_IDS = ['paper', 'plastic', 'can', 'glass', 'vinyl', 'pet', 'carton', 'special'];

function spawn(node) {
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 3500); // 애니메이션이 없을 때 대비
  layer().append(node);
}

/** (x, y) 화면 좌표에서 색 입자 터뜨리기 · color = CSS 값 */
export function burst(x, y, color, n = 12) {
  if (reducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = 36 + Math.random() * 46;
    const p = el('span', { class: 'particle' });
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
    p.style.setProperty('--c', color);
    spawn(p);
  }
}

export function floatText(x, y, text, cls = '') {
  const t = el('span', { class: 'float-text' + (cls ? ' ' + cls : ''), text });
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  spawn(t);
}

/** 손질할 때 떼어 낸 조각(아이콘)이 날아감 */
export function actFly(x, y, icon) {
  if (reducedMotion()) return;
  const t = el('span', { class: 'act-fly', text: icon });
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  spawn(t);
}

export function shake(node) {
  if (!reducedMotion()) flash(node, 'shake');
}

export function confetti(count = 70) {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const c = el('span', { class: 'confetti' });
    c.style.left = `${Math.random() * 100}vw`;
    c.style.setProperty('--c', `var(--bin-${BIN_IDS[i % BIN_IDS.length]})`);
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    c.style.setProperty('--rot', `${(Math.random() - 0.5) * 1440}deg`);
    c.style.setProperty('--t', `${1.6 + Math.random() * 1.2}s`);
    c.style.setProperty('--delay', `${Math.random() * 0.5}s`);
    spawn(c);
  }
}

/** 숫자 올리기(rAF) — 끝나면 스스로 멈춤 */
export function countUp(node, to, ms = 900) {
  if (reducedMotion() || to <= 0) { node.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    node.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** 콤보·FEVER 큰 글자 */
export function bigPop(text, fever = false) {
  const n = document.getElementById('combo-pop');
  n.textContent = text;
  n.classList.toggle('is-fever', fever);
  flash(n, 'show');
}
