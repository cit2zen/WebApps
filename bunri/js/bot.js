// 척척이 로봇 그림 — SVG(createElementNS)로 그리고, 기분은 data-mood + CSS로 바꿈
import { el, reducedMotion } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
export const MOODS = ['idle', 'happy', 'cheer', 'sad', 'worried', 'sleep'];

function s(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') n.textContent = v;
    else n.setAttribute(k, String(v));
  }
  for (const c of children) n.append(c);
  return n;
}

function arm(side) {
  const left = side === 'l';
  const x = left ? 12 : 70;
  return s('g', { class: `b-arm b-arm-${side}` }, [
    s('rect', { class: 'b-limb', x, y: 70, width: 18, height: 8, rx: 4 }),
    s('circle', { class: 'b-hand', cx: left ? 12 : 88, cy: 74, r: 5 }),
  ]);
}

function face() {
  return s('g', { class: 'b-face' }, [
    s('g', { class: 'b-eyes' }, [
      s('g', { class: 'e-open' }, [
        s('circle', { class: 'b-eye', cx: 40, cy: 41, r: 4.6 }),
        s('circle', { class: 'b-eye', cx: 60, cy: 41, r: 4.6 }),
        s('circle', { class: 'b-glint', cx: 41.6, cy: 39.4, r: 1.4 }),
        s('circle', { class: 'b-glint', cx: 61.6, cy: 39.4, r: 1.4 }),
      ]),
      s('path', { class: 'b-stroke e-happy', d: 'M35 43 q5 -7 10 0 M55 43 q5 -7 10 0' }),
      s('path', { class: 'b-stroke e-shut', d: 'M35 42 h10 M55 42 h10' }),
      s('path', { class: 'b-stroke e-sad', d: 'M34 35 l9 -5 M66 35 l-9 -5' }),
    ]),
    s('path', { class: 'b-stroke m-smile', d: 'M43 50 q7 6 14 0' }),
    s('ellipse', { class: 'b-fillink m-open', cx: 50, cy: 51.5, rx: 5, ry: 3.8 }),
    s('path', { class: 'b-stroke m-frown', d: 'M43 54 q7 -5 14 0' }),
    s('path', { class: 'b-stroke m-wavy', d: 'M42 52 q4 -3 8 0 q4 3 8 0' }),
    s('circle', { class: 'b-cheek', cx: 31, cy: 50, r: 3 }),
    s('circle', { class: 'b-cheek', cx: 69, cy: 50, r: 3 }),
  ]);
}

function extras() {
  return s('g', { class: 'b-extras' }, [
    s('path', { class: 'x-tear', d: 'M37 47 q-3 5 0 7 q3 -2 0 -7 z' }),
    s('path', { class: 'x-sweat', d: 'M82 22 q-5 7 0 10 q5 -3 0 -10 z' }),
    s('g', { class: 'x-zz' }, [
      s('text', { class: 'b-zz', x: 78, y: 18, text: 'z' }),
      s('text', { class: 'b-zz b-zz2', x: 86, y: 8, text: 'Z' }),
    ]),
    s('g', { class: 'x-spark' }, [
      s('path', { class: 'b-spark', d: 'M10 30 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z' }),
      s('path', { class: 'b-spark b-spark2', d: 'M86 40 l1.6 -5 l1.6 5 l5 1.6 l-5 1.6 l-1.6 5 l-1.6 -5 l-5 -1.6 z' }),
      s('path', { class: 'b-spark b-spark3', d: 'M78 4 l1.2 -4 l1.2 4 l4 1.2 l-4 1.2 l-1.2 4 l-1.2 -4 l-4 -1.2 z' }),
    ]),
  ]);
}

function robot() {
  return s('svg', { class: 'bot-svg', viewBox: '0 0 100 112', 'aria-hidden': 'true', focusable: 'false' }, [
    s('ellipse', { class: 'b-shadow', cx: 50, cy: 108, rx: 22, ry: 3.5 }),
    s('g', { class: 'b-all' }, [
      s('rect', { class: 'b-tread', x: 33, y: 96, width: 34, height: 9, rx: 4.5 }),
      arm('l'), arm('r'),
      s('rect', { class: 'b-body', x: 29, y: 66, width: 42, height: 33, rx: 11 }),
      s('circle', { class: 'b-badge', cx: 50, cy: 82, r: 9.5 }),
      s('text', { class: 'b-badge-txt', x: 50, y: 86.6, 'text-anchor': 'middle', text: '♻' }),
      s('g', { class: 'b-head' }, [
        s('line', { class: 'b-stroke b-antenna', x1: 50, y1: 21, x2: 50, y2: 11 }),
        s('circle', { class: 'b-bulb', cx: 50, cy: 8, r: 5 }),
        s('rect', { class: 'b-headbox', x: 17, y: 20, width: 66, height: 46, rx: 17 }),
        s('rect', { class: 'b-ear', x: 11, y: 36, width: 7, height: 14, rx: 3 }),
        s('rect', { class: 'b-ear', x: 82, y: 36, width: 7, height: 14, rx: 3 }),
        s('rect', { class: 'b-screen', x: 25, y: 28, width: 50, height: 31, rx: 11 }),
        face(),
      ]),
    ]),
    extras(),
  ]);
}

/**
 * 척척이 하나 만들기 — size: lobby·play·result·lab (CSS 크기)
 * 반환: { root, setBase(mood), mood(mood, ms), say(text, ms), wave() }
 */
export function createBot(size = 'play') {
  const bubble = el('p', { class: 'bot-bubble', 'aria-live': 'polite', hidden: true });
  const root = el('div', { class: `bot bot-${size}`, 'data-mood': 'idle' }, [robot(), bubble]);
  let base = 'idle';
  let moodTimer = 0;
  let sayTimer = 0;
  let blinkTimer = 0;

  const apply = (m) => { root.dataset.mood = m; };
  const api = {
    root,
    get base() { return base; },
    setBase(m) {
      base = m;
      if (!moodTimer) apply(m);
    },
    mood(m, ms = 900) {
      clearTimeout(moodTimer);
      apply(m);
      moodTimer = ms > 0 ? setTimeout(() => { moodTimer = 0; apply(base); }, ms) : 0;
    },
    say(text, ms = 1700) {
      clearTimeout(sayTimer);
      bubble.textContent = text;
      bubble.hidden = false;
      root.classList.remove('is-talking');
      void root.offsetWidth;
      root.classList.add('is-talking');
      sayTimer = setTimeout(() => { bubble.hidden = true; root.classList.remove('is-talking'); }, ms);
    },
    hush() {
      clearTimeout(sayTimer);
      bubble.hidden = true;
      root.classList.remove('is-talking');
    },
    wave() {
      root.classList.remove('is-waving');
      void root.offsetWidth;
      root.classList.add('is-waving');
      setTimeout(() => root.classList.remove('is-waving'), 1800);
    },
  };

  // 눈 깜박임 — 3~5초마다 한 번 (일회성 setTimeout 연쇄)
  const blink = () => {
    if (root.isConnected && root.offsetParent !== null) {
      root.classList.add('is-blink');
      setTimeout(() => root.classList.remove('is-blink'), 150);
    }
    blinkTimer = setTimeout(blink, 3000 + Math.random() * 2000);
  };
  blinkTimer = setTimeout(blink, 1200 + Math.random() * 2000);
  root.dataset.rm = reducedMotion() ? '1' : '0';
  return api;
}
