// js/debug.js — window.__doltap 테스트 훅. 상시 설치, Object.defineProperty로 동결 객체(§6 테스트 훅)
// 단계마다 API를 늘린다(§10 3단계 표). 1단계: daily·gen·hashDay·hashRange·setToday / 2단계: store·wipe·tut·contentFallback
import { daily, todayKST, setToday, addDays, nOf } from './daily.js';
import { generate, rotCW, centroid } from './stones.js';
import { hashDay, hashRange } from './debug_hash.js';
import * as storage from './storage.js';
import * as content from './content.js';
import { createWorld, reHulled } from './physics.js';
import { createRun } from './core.js';
import { fnv } from './rng.js';

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

// ── 4단계: pickSet·루프 훅 (§10 3단계 표 4단계분). game 참조는 B의 stageRefs만 쓴다 ─────
// start(mode, {day?, seed?})의 모드·DailySet 결정. official은 오늘·#N≥1·tries<3일 때만, 아니면 practice(§4)
export function pickSet(mode, { day, seed } = {}, today = todayKST(), S = storage.load()) {
  if (mode === 'random') return { mode, set: generate((seed ?? fnv(String(Date.now()))) >>> 0, today, 0) };
  if (mode === 'official') {
    const d = day ?? today, tries = (S.days && S.days[d] && S.days[d].tries) || 0;
    return { mode: d === today && nOf(d) >= 1 && tries < 3 ? 'official' : 'practice', set: daily(d) };
  }
  return { mode: 'practice', set: seed != null ? generate(seed >>> 0, today, 0) : daily(day ?? today) };
}

// __doltap.start(mode, {day?, seed?, friendCm?}) → DailySet
function startHook(mode, o = {}) {
  const p = pickSet(mode, o);
  stageRefs.game.start(p.mode, p.set, { friendCm: o.friendCm });
  return p.set;
}

// aim·drop·settle·hold에서 최대 n스텝 동기 진행, hold에 진입한 스텝에서 멈춤, 1회 그림
function step(n = 1) {
  const G = stageRefs.game;
  for (let i = 0; i < n && G.running(); i++) {
    const was = G.state();
    G.step();
    if (was !== 'hold' && G.state() === 'hold') break;
  }
  G.frame(0, performance.now());
  return G.state();
}

// state가 name이 될 때까지 스텝, 1000스텝마다 rAF 양보(B의 nextFrame)
async function until(name, max = 24000) {
  const G = stageRefs.game;
  let steps = 0;
  while (G.state() !== name && steps < max && G.running()) {
    G.step();
    steps++;
    if (steps % 1000 === 0) await nextFrame();
  }
  G.frame(0, performance.now());
  const state = G.state();
  return { ok: state === name, steps, state };
}

// bodies = 라이브 판이 있으면 game 월드, 없으면 B의 헤드리스 core 월드(레지스트리 E-3 결정 → e2e_core 유지)
function liveStats() {
  const g = stageRefs.game ? stageRefs.game.stats() : {}, c = coreStats();
  return { ...c, ...g, bodies: g.bodies || c.bodies, reHulled: reHulled() };
}
// ── 4단계 끝 ───────────────────────────────────────────────────────────────

// ── 5단계: lastDrop·speed (§10 3단계 표 5단계분). game·loop 참조는 B의 stageRefs ──────────
const SPEEDS = [1, 2, 4, 8];

// lastDrop(): 미리보기 점 rotCW(v − centroid, aDeg/15) + (x, spawnY)마다 body 점(y 반전)까지
// 최근접 거리의 최댓값(§6). raw = game.lastDropRaw() = {stone, x, spawnY, aDeg, cx, verts}
function lastDropOf(raw) {
  if (!raw) return null;
  const k = ((Math.round(raw.aDeg / 15) % 24) + 24) % 24;
  const [cx, cy] = centroid(raw.stone.verts);
  let err = 0;
  for (const v of raw.stone.verts) {
    const [px, py] = rotCW([v[0] - cx, v[1] - cy], k);
    let m = Infinity;
    for (const q of raw.verts) m = Math.min(m, Math.hypot(px + raw.x - q[0], py + raw.spawnY - q[1]));
    err = Math.max(err, m);
  }
  return { aDeg: raw.aDeg, x: raw.x, cx: raw.cx, maxVertErr: err };
}
// ── 5단계 끝 ───────────────────────────────────────────────────────────────

export function install({ game = null, loop = null } = {}) {
  stageRefs = { game, loop };
  const api = {
    // 1단계
    daily: day => daily(day ?? todayKST()),
    gen: seed => generate(seed >>> 0, todayKST(), 0),
    hashDay: day => hashDay(day),
    hashRange: (from, days) => hashRange(from, days),
    setToday: day => { const t = setToday(day ?? null); if (stageRefs.game) stageRefs.game.hook('lobby'); return t; },
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
    stats: liveStats,
    state: coreState,
    // 4단계
    start: startHook,
    step, until,
    layout: () => stageRefs.game.layout(),
    view: () => stageRefs.game.view(),
    height: () => stageRefs.game.height(),
    seed: () => stageRefs.game.seed(),
    dispatch: a => stageRefs.game.dispatch(a),
    // 5단계
    aim: (x, aDeg) => stageRefs.game.aimTo(x, aDeg),
    drop: () => stageRefs.game.dropNow(),
    skip: () => stageRefs.game.skipNow(),
    lastDrop: () => lastDropOf(stageRefs.game.lastDropRaw()),
    speed: m => { if (SPEEDS.includes(m)) stageRefs.loop.setSpeed(m); return stageRefs.loop.getSpeed(); },
    pause: () => stageRefs.game.pause(),
    resume: () => stageRefs.game.resume(),
    audio: () => stageRefs.game.audioState(),
    mute: b => stageRefs.game.setMute(!!b),
  };
  Object.defineProperty(window, '__doltap', {
    value: Object.freeze(api), writable: false, configurable: false, enumerable: false,
  });
  return { game, loop };
}
