// js/debug.js — window.__doltap 테스트 훅. 상시 설치, Object.defineProperty로 동결 객체(§6 테스트 훅)
// 단계마다 API를 늘린다(§10 3단계 표). 1단계: daily·gen·hashDay·hashRange·setToday / 2단계: store·wipe·tut·contentFallback
import { daily, todayKST, setToday, addDays } from './daily.js';
import { generate } from './stones.js';
import { hashDay, hashRange } from './debug_hash.js';
import * as storage from './storage.js';
import * as content from './content.js';
import { createWorld, reHulled } from './physics.js';
import { createRun } from './core.js';

// 네트워크 요청 없이 실패하는 fetch 스텁(§5 폴백 경로 검증)
const failingFetch = () => Promise.reject(new TypeError('contentFallback: fetch 스텁'));

// ── 3단계: 헤드리스 core·볼록 검사·stats·state (§10 3단계 표) ──────────────
let stageRefs = { game: null, loop: null };        // install({game, loop})가 넣는다(4단계 이후도 이 참조만 쓴다)
let head = null;                                   // 헤드리스 core 1판 { day, W, R }
const nextFrame = () => new Promise(r => requestAnimationFrame(r));

// core(day, {x?, aDeg?, reset?}) → {slot, candles, state}: 저장 없이 1슬롯 진행(practice 모드).
// 같은 day면 이어서 진행하고, 다른 day·reset·끝난 판이면 새 월드에서 새 판을 연다.
function coreHook(day, o = {}) {
  if (!head || head.day !== day || o.reset || head.R.view().state === 'done') {
    if (head) head.W.destroy();
    const W = createWorld();
    head = { day, W, R: createRun(daily(day), { mode: 'practice', W }) };
  }
  const { R } = head;
  if (R.view().state === 'aim') {
    const from = R.view().slot;
    if (o.x != null) R.dispatch({ t: 'setX', x: o.x });
    for (let k = 0; k < Math.round((o.aDeg || 0) / 15); k++) R.dispatch({ t: 'rot', d: 1 });
    R.dispatch({ t: 'drop' });
    for (let n = 0; n < 24000; n++) {
      const v = R.view();
      if (v.state === 'done' || (v.state === 'aim' && v.slot > from)) break;
      R.step();
    }
  }
  const v = R.view();
  return { slot: v.slot, candles: v.candles, state: v.state === 'done' ? 'result' : v.state };
}

// convexCheck(from, days): 날짜별 DailySet 24개를 dropStone과 같은 변환으로 만들고 즉시 제거한다.
async function convexCheck(from, days) {
  const W = createWorld();
  const r0 = reHulled();
  let stones = 0;
  try {
    for (let k = 0; k < days; k++) {
      for (const st of daily(addDays(from, k)).stones) {
        W.remove(W.dropStone(st, 195, 500, 0));
        if (++stones % 500 === 0) await nextFrame();
      }
    }
  } finally { W.destroy(); }
  return { stones, reHulled: reHulled() - r0 };
}

const coreStats = () => ({ reHulled: reHulled(), bodies: head ? head.W.stones().length + 1 : 0 });
const coreState = () => (stageRefs.game ? stageRefs.game.state() : 'boot');
// ── 3단계 끝 ───────────────────────────────────────────────────────────────

export function install({ game = null, loop = null } = {}) {
  stageRefs = { game, loop };
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
    // 3단계
    core: coreHook,
    convexCheck,
    stats: coreStats,
    state: coreState,
  };
  Object.defineProperty(window, '__doltap', {
    value: Object.freeze(api), writable: false, configurable: false, enumerable: false,
  });
  return { game, loop };
}
