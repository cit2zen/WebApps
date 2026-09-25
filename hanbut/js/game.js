// game.js — §2 상태 머신 7상태 + dispatch 리듀서(§6 허용 표) + tick(dt) + view() + 이벤트 15종
import { createGrid } from './grid.js';
import * as M from './moves.js';
import * as S from './score.js';
import { hint as solveHint } from './solver.js';
import * as store from './store.js';
import { dayIndex, recordDaily } from './daily.js';

const DUR = { level_in: 300, clearing: 350, result: 900, pack_done: 1200 };
const ALLOW = {
  idle: ['enter', 'enterDaily', 'key'], level_in: [], clearing: [], pack_done: [],
  playing: ['down', 'move', 'up', 'push', 'pop', 'cut', 'reset', 'hint', 'pause', 'key'],
  paused: ['resume', 'lobby', 'key'],
  result: ['skip', 'next', 'prev', 'lobby', 'key'],
};
const KEYS = {
  idle: ['confirm'], paused: ['confirm', 'esc', 'lobby'],
  playing: ['up', 'down', 'left', 'right', 'pop', 'reset', 'hint', 'esc'],
  result: ['confirm', 'next', 'prev', 'lobby'],
};
const DIRS = ['up', 'down', 'left', 'right'];
const HINT_IDLE = 20000, GHOST_IDLE = 8000, SHUTTER_AT = 850;

export function createGame(levelsIn, progressIn) {
  const levels = Array.isArray(levelsIn) ? levelsIn : (levelsIn && levelsIn.levels) || [];
  let prog = S.normalizeProgress(progressIn);
  let state = 'idle', pendingTo = null, pendL = 0, pendDir = 'r', elapsed = 0, shutter = false;
  let lv = null, g = null, st = M.createMoveState(), t = 0, idleMs = 0;
  let hintReady = false, ghost = false, hintUsed = false, res = null;
  let mode = 'levels', dm = null;                     // 'daily': dm = { level, i, ymd } — 본편 진행 불변
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hs = {};
  const V = { state, mode, L: 0, n: 0, len: 0, head: -1, path: [], u: 0, rewindSegments: 0, resets: 0, hintUsed: false,
    deadEnds: 0, t: 0, streak: 0, remain: 0, hintReady: false, ghost: false, reduced, level: null, visited: null };

  function on(type, fn) { (hs[type] || (hs[type] = [])).push(fn); return () => off(type, fn); }
  function off(type, fn) { const a = hs[type]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  function emit(type, p) { const a = hs[type]; if (a) for (const f of a.slice()) f(p); }
  function go(to, L = 0, dir = 'r') { pendingTo = to; pendL = L; pendDir = dir; return true; }
  const cur = () => pendingTo || state;

  function setGhost(on) { if (ghost !== on) { ghost = on; emit('ghost', { on }); } }
  function updateGhost() {
    setGhost(state === 'playing' && !pendingTo && !!g && g.len === 1 && (lv.L === 1 || idleMs >= GHOST_IDLE));
  }
  function setHintReady() { if (!hintReady) { hintReady = true; emit('hintReady', {}); } }

  // 틱 ①: 예약 전이 1회 적용 + 진입 처리
  function apply() {
    const from = state, to = pendingTo; pendingTo = null;
    if (from === to) return;
    state = to; elapsed = 0;
    emit('state', { from, to });
    if (to === 'level_in') {
      lv = mode === 'daily' ? dm.level : levels[pendL - 1]; g = createGrid(lv); st = M.createMoveState();
      t = 0; idleMs = 0; hintReady = false; hintUsed = false; res = null; setGhost(false);
      emit('levelIn', { L: pendL, dir: pendDir, mode, ymd: dm && mode === 'daily' ? dm.ymd : null });
    } else if (to === 'playing') updateGhost();
    else if (to === 'result') emit('result', res);
    else if (to === 'pack_done') { shutter = false; emit('packDone', { k: S.packOf(lv.L), score: S.packScore(prog.stars, S.packOf(lv.L)) }); }
    else if (to === 'idle') { setGhost(false); lv = null; g = null; res = null; }
  }

  // result 이후 진행: 팩 끝 → pack_done, 다음 레벨 → level_in, 마지막 → idle
  function advance() {
    if (mode === 'daily') return go('idle');                             // 데일리 결과 → 로비
    if (res && res.packEnd) return go('pack_done');
    if (lv.L < levels.length) return go('level_in', lv.L + 1, 'r');
    return go('idle');
  }

  function timerDone() {
    if (state === 'level_in') go('playing');
    else if (state === 'clearing') go('result');
    else if (state === 'result') { if (!res.pauseCard) advance(); }
    else if (state === 'pack_done') go('idle');
  }

  function tick(dt) {
    if (pendingTo) apply();
    const dur = DUR[state];
    if (dur) {
      elapsed += dt;
      if (state === 'pack_done' && !shutter && elapsed >= SHUTTER_AT) { shutter = true; emit('packShutter', { k: S.packOf(lv.L) }); }
      if (!pendingTo && elapsed >= dur) timerDone();
    }
    if (state === 'playing' && !pendingTo) {
      t += dt; idleMs += dt;
      if (idleMs >= HINT_IDLE) setHintReady();
      updateGhost();
    }
  }

  function clear() {
    const u = S.computeU(st.rewindSegments, st.resets), s = S.starsFor(u, hintUsed), L = lv.L;
    if (mode === 'daily') res = recordDaily(dm, lv, s, u, hintUsed, prog.streak); else {   // 데일리 = hanbut:daily만
      prog = S.applyClear(prog, L, s);
      try { store.saveProgress(prog); } catch (e) { /* 저장 실패는 진행 유지 */ }
      try { store.appendLog(S.logEntry(L, t, u, s)); } catch (e) { /* 무시 */ }
      res = { L, stars: s, u, streak: prog.streak, hintUsed, pauseCard: S.isPauseCard(L), packEnd: S.isPackEnd(L) };
    }
    go('clearing'); setGhost(false);
    emit('clear', { path: g.path });
  }

  // moves 결과 emit + 클리어·힌트 트리거
  function input(r) {
    idleMs = 0;
    for (const e of r.events) { const { type, ...p } = e; emit(type, p); }
    if (st.deadEnds >= 3) setHintReady();
    if (g.isClear()) clear(); else updateGhost();
    return r.ok;
  }

  function doHint() {
    if (!hintReady) return false;
    hintUsed = true; idleMs = 0;
    emit('hint', solveHint(g, lv.sol));
    return true;
  }

  function enter(L, force) {
    if (!Number.isInteger(L) || L < 1 || L > levels.length) return false;
    if (!force && L > prog.maxClearedLevel + 1) return false;            // 규칙 13
    mode = 'levels'; return go('level_in', L, 'r');
  }

  // 오늘의 한붓: 로드·검증된 데일리 레벨 객체로 진입(i·ymd 생략 시 오늘 §5 색인)
  function enterDaily(a) {
    const l = a.level; if (!l || !Array.isArray(l.sol) || !Number.isInteger(l.w) || !Number.isInteger(l.h)) return false;
    const d = dayIndex(); mode = 'daily'; dm = { level: l, i: Number.isInteger(a.i) ? a.i : d.i, ymd: typeof a.ymd === 'string' ? a.ymd : d.ymd };
    return go('level_in', 0, 'r');
  }

  function key(a) {
    const s = cur();
    if (!KEYS[s] || !KEYS[s].includes(a)) return false;
    if (s === 'idle') { const m = prog.maxClearedLevel; return enter(m >= levels.length ? 1 : m + 1); }
    if (s === 'paused') return a === 'lobby' ? go('idle') : go('playing');
    if (s === 'result') {
      if (a === 'lobby') return go('idle');
      if (a === 'prev') return lv.L >= 2 ? go('level_in', lv.L - 1, 'l') : false;
      return advance();                                                  // confirm(스킵·정지 카드 next)·next
    }
    idleMs = 0;
    if (DIRS.includes(a)) return input(M.keyDir(g, st, a));
    if (a === 'pop') return input(M.pop(g, st));
    if (a === 'reset') return input(M.reset(g, st));
    if (a === 'hint') return doHint();
    return go('paused');                                                 // esc
  }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') return false;
    const s = cur(), ty = action.type;
    if (!ALLOW[s].includes(ty)) return false;
    switch (ty) {
      case 'enter': return enter(action.L, !!action.force);
      case 'enterDaily': return enterDaily(action);
      case 'down': return input(M.down(g, st, action.cell));
      case 'move': return input(M.move(g, st, action.cells));
      case 'up': M.up(g, st); return true;
      case 'push': return input(M.push(g, st, action.cell));
      case 'pop': return input(M.pop(g, st));
      case 'cut': return input(M.cut(g, st, action.cell));
      case 'reset': return input(M.reset(g, st));
      case 'hint': return doHint();
      case 'pause': return go('paused');
      case 'resume': return go('playing');
      case 'lobby': return go('idle');
      case 'skip': return res && res.pauseCard ? false : advance();
      case 'next': return advance();
      case 'prev': return lv.L >= 2 ? go('level_in', lv.L - 1, 'l') : false;
      case 'key': return key(action.action);
      default: return false;
    }
  }

  function view() {
    V.state = state; V.mode = mode; V.level = lv; V.reduced = reduced; V.streak = prog.streak;
    V.hintReady = hintReady; V.ghost = ghost; V.hintUsed = hintUsed; V.t = t;
    V.rewindSegments = st.rewindSegments; V.resets = st.resets; V.deadEnds = st.deadEnds;
    V.u = S.computeU(st.rewindSegments, st.resets);
    V.L = (lv && lv.L) || 0; V.n = g ? g.n : 0; V.len = g ? g.len : 0; V.head = g ? g.head : -1;
    V.path = g ? g.path : V.path; V.remain = g ? g.remain() : 0; V.visited = g ? g.visited : null;
    return V;
  }

  function setProgress(obj) {
    if (cur() !== 'idle') return false;
    prog = S.normalizeProgress(obj); return true;
  }

  return {
    dispatch, tick, view, on, off,
    enter: (L, force = true) => (cur() === 'idle' ? enter(L, force) : false),   // 테스트 훅용: 잠금 무시
    state: () => state, pending: () => pendingTo, level: () => lv, grid: () => g,
    progress: () => prog, setProgress, result: () => res, mode: () => mode,
  };
}
