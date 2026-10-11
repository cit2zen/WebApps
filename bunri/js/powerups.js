// 황금 아이템 — ⏳ 슬로우 · 💡 힌트 · ❤️ 하트 · 🛡️ 방패 · 하트 잃기(방패·복습 처리)
import { $ } from './dom.js';
import { floatText } from './fx.js';
import { sfx } from './audio.js';
import { emit } from './events.js';

export const SLOW_TIME = 5;
export const HINT_COUNT = 3;
export const MAX_HEARTS = 3;
export const FULL_HEART_BONUS = 200;

const POWERS = [
  { id: 'slow', emoji: '⏳', name: '슬로우' },
  { id: 'hint', emoji: '💡', name: '힌트' },
  { id: 'heart', emoji: '❤️', name: '하트 +1' },
  { id: 'shield', emoji: '🛡️', name: '방패' },
];
const byId = (id) => POWERS.find((p) => p.id === id);

export const firstPowerAt = (rng = Math.random) => 11 + rng() * 5;
/** 황금 비(golden): 8–11초마다 · 보통 15–20초마다 */
export const nextPowerAt = (t, rng = Math.random, golden = false) => t + (golden ? 8 + rng() * 3 : 15 + rng() * 5);

export function pickPower(S) {
  const rng = S.rng || Math.random;
  // 하트가 가득이면 하트 확률을 낮춤 · 방패를 들고 있으면 방패는 빼고
  const pool = POWERS.filter((p) => !(p.id === 'heart' && S.hearts >= S.maxHearts) && !(p.id === 'shield' && S.shield));
  pool.push(byId('heart'));
  const p = pool[Math.floor(rng() * pool.length)];
  // 하트 하나(onelife): 하트 대신 방패
  return p.id === 'heart' && S.mod === 'onelife' ? byId('shield') : p;
}

/** 효과 적용 → 화면에 띄울 문구 */
export function applyPower(S, p) {
  if (p.id === 'slow') { S.slowLeft = SLOW_TIME; return '⏳ 슬로우! 벨트가 느려져요'; }
  if (p.id === 'hint') { S.hint = HINT_COUNT; return '💡 힌트! 정답 수거함이 반짝여요'; }
  if (p.id === 'shield') {
    if (!S.shield) { S.shield = 1; return '🛡️ 방패! 다음 실수 한 번을 막아요'; }
    S.score += FULL_HEART_BONUS;
    return `🛡️ 방패가 이미 있어요! +${FULL_HEART_BONUS}`;
  }
  if (S.hearts < S.maxHearts) { S.hearts += 1; return '❤️ 하트 +1'; }
  S.score += FULL_HEART_BONUS;
  return `❤️ 하트가 가득! +${FULL_HEART_BONUS}`;
}

/** 오답·놓침 한 번 — 방패가 막거나(복습은 하트가 안 줄어요) 하트 −1 · 하트를 잃었으면 true */
export function takeHit(S) {
  if (S.mode === 'review') return false;
  if (S.shield > 0) {
    S.shield = 0;
    emit('shield', {});
    sfx('shield');
    const r = $('#hud-hearts').getBoundingClientRect();
    floatText(r.left + r.width / 2, r.bottom + 10, '🛡️ 막았어요!', 'is-small');
    return false;
  }
  S.hearts -= 1;
  return true;
}

let shown = '';
export function renderPower(S) {
  const box = $('#hud-power');
  let icon = '', p = 0;
  if (S && S.slowLeft > 0) { icon = '⏳'; p = S.slowLeft / SLOW_TIME; }
  else if (S && S.hint > 0) { icon = '💡'; p = S.hint / HINT_COUNT; }
  box.hidden = !icon;
  if (!icon) { shown = ''; return; }
  if (icon !== shown) { $('#hud-power-icon').textContent = icon; shown = icon; }
  box.style.setProperty('--p', p.toFixed(3));
}
