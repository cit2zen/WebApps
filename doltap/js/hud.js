// hud.js — S7 DOM HUD·튜토리얼 고스트·S8 카운트·가로 화면 오버레이·손잡이 좌우 반전·poll(now) (§4 S7/S8)
// game만 import한다. 클래스는 Task 4a play.css 훅, id는 테스트용. 버튼 액션은 mount(cb)의 cb.onAction으로 보낸다
import { h, setText, fmt, setAria } from './dom.js';
import S from './strings.js';
import { drawStoneThumb } from './render.js';

const E = {};
const COMBO = '퍼펙트 ×{n}';
const SKIP_MS = 400;
let cb = { onAction() {} }, armT = null, lit = 3;

const btn = (id, cls, label, text) => h('button', { id, type: 'button', class: cls, 'aria-label': label }, text);

// #game 안: #hud(.hud-candles·.hud-height>#height+#heightSub·.hud-preview·.hud-skip·.hud-combo·
// .hud-bar>(.hud-zone>⏸↺↻ + .cancel-hint)) + .ghost + #count + .portrait. 표시/숨김은 hidden 속성
function build() {
  E.game = document.getElementById('game');
  E.hud = h('div', { id: 'hud' });
  E.candles = h('div', { id: 'candles', class: 'hud-candles', 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) E.candles.appendChild(h('span', { class: 'candle' }, '🕯️'));
  const hv = h('div', { class: 'hud-height' });
  E.height = h('span', { id: 'height', class: 'pol-hud-value', role: 'status' }, '0.0cm');
  E.sub = h('span', { id: 'heightSub', class: 'hud-sub' });
  hv.append(E.height, E.sub);
  E.preview = h('div', { id: 'preview', class: 'hud-preview', 'aria-hidden': 'true' });
  for (let i = 0; i < 2; i++) E.preview.appendChild(h('canvas', { class: 'pv' }));
  E.skip = h('button', { id: 'skip', type: 'button', class: 'hud-skip' }, S.hud.skip);
  E.combo = h('div', { id: 'combo', class: 'hud-combo off', 'aria-live': 'polite' });
  E.pause = btn('pause', 'btn-pause', S.hud.pause, '⏸');
  E.rotCcw = btn('rotCcw', 'btn-ccw', S.hud.rotCcw, '↺');
  E.rotCw = btn('rotCw', 'btn-cw', S.hud.rotCw, '↻');
  const zone = h('div', { class: 'hud-zone' });
  zone.append(E.pause, E.rotCcw, E.rotCw);
  E.hint = h('div', { id: 'cancelHint', class: 'cancel-hint' }, S.hud.cancelHint);
  E.bar = h('div', { id: 'bar', class: 'hud-bar' });
  E.bar.append(zone, E.hint);
  E.hud.append(E.candles, hv, E.preview, E.skip, E.combo, E.bar);
  E.ghost = h('div', { id: 'ghost', class: 'ghost', 'aria-hidden': 'true' }, '👆');
  E.count = h('div', { id: 'count', role: 'timer' });
  E.portrait = h('div', { id: 'portrait', class: 'portrait', role: 'alert' }, S.hud.portrait);
  E.game.append(E.hud, E.ghost, E.count, E.portrait);
}

export function mount(c) {
  cb = c;
  if (E.hud) return;
  build();
  for (const b of [E.skip, E.pause, E.rotCcw, E.rotCw]) b.addEventListener('pointerdown', e => e.preventDefault());
  E.skip.addEventListener('pointerdown', e => cb.onAction({ t: 'skipTap', at: e.timeStamp }));
  E.pause.addEventListener('click', () => cb.onAction({ t: 'pause' }));
  reset({});
}

export const el = name => E[name];

// 새 판 시작 때 전체 초기화. 보조 줄: 친구 기록 > 개인 최고 > 빈 값
function subLine(friend, best) {
  if (friend != null) return fmt(S.hud.subFriend, { F: friend.toFixed(1) });
  return best > 0 ? fmt(S.hud.subBest, { best: best.toFixed(1) }) : '';
}
export function reset({ hand = 'R', ghost = false, friend = null, best = 0 }) {
  lit = 3;
  for (const c of E.candles.children) c.classList.remove('off');
  E.candles.classList.remove('shake');
  height(0);
  setText(E.sub, subLine(friend, best));
  combo(0);
  skipArm(null);
  E.skip.removeAttribute('aria-disabled');
  E.hud.classList.remove('hold');
  E.hud.classList.toggle('hand-l', hand === 'L');
  cancelHint(false);
  E.ghost.hidden = !ghost;
  count(null);
  E.portrait.hidden = true;
}

export function height(H) { setText(E.height, `${H.toFixed(1)}cm`); }

// 낙석으로 줄어들 때 오른쪽부터 끄고(CSS 300ms 페이드) 줄 전체를 --dur-fast 동안 흔든다
export function candles(n) {
  const list = [...E.candles.children];
  list.forEach((c, i) => c.classList.toggle('off', i >= n));
  if (n < lit) {
    E.candles.classList.remove('shake');
    void E.candles.offsetWidth;
    E.candles.classList.add('shake');
  }
  lit = n;
}

// 다음 돌 2개(없으면 빈 칸). 40×40 css, dpr ≤ 2 backing. render.drawStoneThumb(ctx, stone, box)
export function preview(stones) {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  [...E.preview.children].forEach((cv, i) => {
    cv.width = Math.round(40 * d); cv.height = Math.round(40 * d);
    const ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, 40, 40);
    if (stones[i]) drawStoneThumb(ctx, stones[i], { x: 0, y: 0, w: 40, h: 40 });
  });
}

export function combo(n) {
  E.combo.classList.toggle('off', n < 1);
  if (n >= 1) setText(E.combo, fmt(COMBO, { n }));
}

// 건너뛰기 첫 탭: 400ms 동안 금색 확인(.confirm) + '한 번 더'. t=null이면 해제
export function skipArm(t) {
  armT = t;
  E.skip.classList.toggle('confirm', t != null);
  setText(E.skip, t != null ? S.hud.skipConfirm : S.hud.skip);
}

export function skipUsed() {
  skipArm(null);
  E.skip.setAttribute('aria-disabled', 'true');
}

export function hold(on) { E.hud.classList.toggle('hold', on); }

// S8 카운트 3·2·1(null이면 숨김)
export function count(n) {
  E.count.hidden = n == null;
  setText(E.count, n == null ? '' : String(n));
  if (n != null) setAria(E.count, fmt(S.hud.hold, { t: n }));
}

export function ghost(on) { E.ghost.hidden = !on; }
export function portrait(on) { E.portrait.hidden = !on; }

export function cancelHint(on) {
  E.hint.hidden = !on;
  E.bar.classList.toggle('cancel', on);
}

// 매 프레임(game.frame 안): 건너뛰기 확인 해제
export function poll(now) {
  if (armT != null && now - armT >= SKIP_MS) skipArm(null);
}
