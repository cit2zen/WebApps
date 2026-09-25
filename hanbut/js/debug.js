// debug.js — window.__hanbut 테스트 훅(§6 테스트 훅 · §8 자동화 우회). 상시 설치, 민감 정보 없음.
// 게임 인스턴스·clock은 main.js가 installHook(ctx)로 주입(game은 main에서 createGame으로 생성되므로).
import * as rng from './rng.js';
import * as store from './store.js';
import * as levels from './levels.js';
import * as render from './render.js';
import * as fx from './fx.js';
import * as hud from './hud.js';
import * as audio from './audio.js';
import * as lobby from './lobby.js';

const STEP_DT = 16.7;

// ctx = { game, clock, board, play, levelsJson, settings, applyProgress(p) }
export function installHook(ctx) {
  const { game, clock, board, play } = ctx;
  const view = () => game.view();
  const state = () => game.state();
  const level = () => (typeof game.level === 'function' ? game.level() : view().level) || null;

  function drawNow() { if (!play.hidden) render.draw(game.view(), fx.list()); }

  function step(ms) {
    const n = Math.max(0, Math.ceil(ms / STEP_DT));
    for (let i = 0; i < n; i++) {
      clock.t += STEP_DT;
      game.tick(STEP_DT); fx.tick(STEP_DT); hud.tick(STEP_DT);
    }
    game.tick(0);                                     // 정산 틱: 마지막 틱에서 기록된 pendingTo 적용
    drawNow();
    return clock.t;
  }

  function draw(cells) {
    const v0 = view();
    let i = cells.length && cells[0] === v0.head ? 1 : 0;
    for (; i < cells.length; i++) {
      if (!game.dispatch({ type: 'push', cell: cells[i] })) return { ok: false, len: view().len, failedAt: i };
    }
    return { ok: true, len: view().len, failedAt: null };
  }

  function enter(L) {
    if (state() !== 'idle') return false;
    if (typeof game.enter === 'function') return !!game.enter(L, true);
    return !!game.dispatch({ type: 'enter', L, force: true });   // INTERFACE ASSUMPTION: force = 규칙 13 잠금 무시
  }

  function cellCenter(idx) {
    const r = board.getBoundingClientRect();
    if (typeof render.cellRect === 'function') {
      const c = render.cellRect(idx);                               // board 로컬 CSS px {x,y,w,h}
      return { x: r.left + c.x + c.w / 2, y: r.top + c.y + c.h / 2 };
    }
    const Lg = typeof render.layout === 'function' ? render.layout() : render.L;   // {cell, ox, oy}
    const w = level().w, col = idx % w, row = Math.floor(idx / w);
    return { x: r.left + Lg.ox + (col + 0.5) * Lg.cell, y: r.top + Lg.oy + (row + 0.5) * Lg.cell };
  }

  function drawCalls() {
    if (typeof render.drawCalls === 'function') return render.drawCalls();
    return typeof render.calls === 'number' ? render.calls : -1;
  }

  function validateLevels() {
    const res = levels.validateLevels(ctx.levelsJson, 'levels');
    return { ok: !!(res && res.ok), errors: (res && res.errors) || [] };
  }

  function tones() {
    if (typeof audio.tones === 'function') return audio.tones().slice();
    return Array.from(audio.TONES || audio.FREQS || []);
  }

  function audioInfo() {
    if (typeof audio.info === 'function') return audio.info();
    const s = store.loadSettings();
    return {
      state: typeof audio.state === 'function' ? audio.state() : 'none',
      sound: s.sound, vibrate: s.vibrate,
      unlockAttempts: typeof audio.unlockAttempts === 'number' ? audio.unlockAttempts : 0,
    };
  }

  function setProgress(obj) {
    if (state() !== 'idle') return false;
    if (store.saveProgress(obj) === false) return false;
    if (typeof game.setProgress === 'function' && game.setProgress(obj) === false) return false;
    lobby.renderLobby();
    return true;
  }

  function wipe() {                                   // 설정 제외 초기화 — ctx.wipe(main)가 설정 화면과 같은 경로
    if (typeof ctx.wipe === 'function') return ctx.wipe();
    store.wipe();
    if (typeof game.setProgress === 'function') game.setProgress(store.loadProgress());
    lobby.renderLobby();
    return true;
  }

  const hook = {
    version: 1,
    state, level,
    view: () => view(),
    enter,
    dispatch: action => game.dispatch(action),
    draw, step,
    speed(x) { if (typeof x === 'number' && x >= 0 && Number.isFinite(x)) clock.speed = x; return clock.speed; },
    seed(n) { rng.seed(n); return n; },
    cellCenter, drawCalls, validateLevels, tones,
    audio: audioInfo,
    progress: () => store.loadProgress(),
    setProgress,
    dumpLog: () => store.dumpLog(),
    wipe,
  };
  Object.defineProperty(window, '__hanbut', { value: Object.freeze(hook), configurable: true, writable: false });
  return hook;
}
