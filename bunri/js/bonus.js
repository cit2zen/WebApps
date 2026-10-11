// 보너스 OX — 벨트가 멈추고 6초 안에 ⭕/❌
import { $ } from './dom.js';
import { sfx } from './audio.js';

export const BONUS_TIME = 6;
let cur = null; // { q, left, sec, res }

/** 반환 Promise: true(정답) · false(오답) · null(시간 초과) */
export function openBonus(q) {
  $('#bonus-q').textContent = q.q;
  $('#bonus-sec').textContent = String(BONUS_TIME);
  $('#bonus-ring').style.setProperty('--p', '1');
  $('#bonus').hidden = false;
  return new Promise((res) => { cur = { q, left: BONUS_TIME, sec: BONUS_TIME, res }; });
}

export function bonusTick(dt) {
  if (!cur) return;
  cur.left -= dt;
  $('#bonus-ring').style.setProperty('--p', Math.max(0, cur.left / BONUS_TIME).toFixed(3));
  const sec = Math.max(0, Math.ceil(cur.left));
  if (sec !== cur.sec) {
    cur.sec = sec;
    $('#bonus-sec').textContent = String(sec);
    if (sec > 0 && sec <= 3) sfx('tick');
  }
  if (cur.left <= 0) settle(null);
}

function settle(said) {
  const c = cur;
  cur = null;
  $('#bonus').hidden = true;
  c.res(said === null ? null : said === c.q.answer);
}

export const bonusOpen = () => !!cur;

export function bonusAnswer(said) {
  if (!cur) return false;
  settle(said);
  return true;
}

/** 판이 끝날 때 — 결과를 돌려주지 않고 닫음 */
export function closeBonus() {
  cur = null;
  $('#bonus').hidden = true;
}
