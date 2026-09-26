// js/debug.js — window.__doltap 테스트 훅. 상시 설치, Object.defineProperty로 동결 객체(§6 테스트 훅)
// 단계마다 API를 늘린다(§10 3단계 표). 1단계: daily·gen·hashDay·hashRange·setToday / 2단계: store·wipe·tut·contentFallback
import { daily, todayKST, setToday } from './daily.js';
import { generate } from './stones.js';
import { hashDay, hashRange } from './debug_hash.js';
import * as storage from './storage.js';
import * as content from './content.js';

// 네트워크 요청 없이 실패하는 fetch 스텁(§5 폴백 경로 검증)
const failingFetch = () => Promise.reject(new TypeError('contentFallback: fetch 스텁'));

export function install({ game = null, loop = null } = {}) {
  const api = {
    // 1단계
    daily: day => daily(day ?? todayKST()),
    gen: seed => generate(seed >>> 0, todayKST(), 0),
    hashDay: day => hashDay(day),
    hashRange: (from, days) => hashRange(from, days),
    setToday: day => setToday(day ?? null),
    // 2단계
    store: () => JSON.parse(JSON.stringify(storage.load())),
    wipe: () => storage.wipe(),
    tut: b => storage.set('tutDone', !!b),
    contentFallback: async () => {
      const c = await content.load(failingFetch);
      const p = content.pick(c, daily(todayKST()));
      return { wish: p.wish, trail: p.trail, fallback: p.fallback };
    },
  };
  Object.defineProperty(window, '__doltap', {
    value: Object.freeze(api), writable: false, configurable: false, enumerable: false,
  });
  return { game, loop };
}
