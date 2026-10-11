// 🔥 러시 타임 — 마지막 10초(무한 도전은 60초마다 8초): 벨트 ×1.3 · 간격 ×0.75 · 점수 ×1.5
import { $ } from './dom.js';
import { sfx } from './audio.js';
import { emit } from './events.js';

export const RUSH_TIME = 10;          // 시간제 판: 남은 시간 ≤ 10초
export const RUSH_ENDLESS_EVERY = 60; // 무한 도전: 60초마다
export const RUSH_ENDLESS_LEN = 8;    //   8초 동안
export const RUSH_SPEED = 1.3;
export const RUSH_GAP = 0.75;

function setRush(S, on) {
  if (S.rush === on) return;
  S.rush = on;
  $('#play').classList.toggle('is-rush', on);
  $('#rush-banner').hidden = !on;
  emit('rush', { on });
  if (on) sfx('rush');
}

/** 매 프레임 — 러시 시작/끝 판단 */
export function rushTick(S, dt) {
  if (S.mode === 'review') return;
  if (S.mode === 'endless') {
    if (S.rush) {
      S.rushLeft -= dt;
      if (S.rushLeft <= 0) setRush(S, false);
    } else if (S.elapsed >= S.rushNext) {
      S.rushNext += RUSH_ENDLESS_EVERY;
      S.rushLeft = RUSH_ENDLESS_LEN;
      setRush(S, true);
    }
    return;
  }
  if (S.timeMax && !S.rush && S.timeLeft <= RUSH_TIME) setRush(S, true);
}

/** 판이 끝날 때(결과 전에) */
export function endRush(S) {
  if (S) setRush(S, false);
  $('#play').classList.remove('is-rush');
  $('#rush-banner').hidden = true;
}

export const rushSpeed = (S) => (S.rush ? RUSH_SPEED : 1);
export const rushGap = (S) => (S.rush ? RUSH_GAP : 1);
