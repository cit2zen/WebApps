// js/debug.js — window.__doltap 테스트 훅. 상시 설치, Object.defineProperty로 동결 객체(§6 테스트 훅)
// 단계마다 API를 늘린다(§10 3단계 표). 1단계: daily·gen·hashDay·hashRange·setToday
import { daily, todayKST, setToday } from './daily.js';
import { generate } from './stones.js';
import { hashDay, hashRange } from './debug_hash.js';

export function install({ game = null, loop = null } = {}) {
  const api = {
    daily: day => daily(day ?? todayKST()),
    gen: seed => generate(seed >>> 0, todayKST(), 0),
    hashDay: day => hashDay(day),
    hashRange: (from, days) => hashRange(from, days),
    setToday: day => setToday(day ?? null),
  };
  Object.defineProperty(window, '__doltap', {
    value: Object.freeze(api), writable: false, configurable: false, enumerable: false,
  });
  return { game, loop };
}
