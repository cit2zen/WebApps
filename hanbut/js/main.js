// main.js — 부팅 순서 ①~⑨ · 단일 rAF 루프(내부 시계 clock) · UI init 주입 · 게임 이벤트 배선(§6)
import * as render from './render.js';
import * as store from './store.js';
import * as levels from './levels.js';
import { createGame } from './game.js';
import * as input from './input.js';
import * as keys from './keys.js';
import * as hud from './hud.js';
import * as cards from './cards.js';
import * as lobby from './lobby.js';
import * as fx from './fx.js';
import * as fxClear from './fx_clear.js';
import * as audio from './audio.js';
import { installHook } from './debug.js';
import { setText } from './strings.js';

const $ = id => document.getElementById(id);
const lobbyEl = $('lobby'), play = $('play'), board = $('board');
const clock = { t: 0, speed: 1 };                       // __hanbut.step()/speed()가 조작
let game = null, last = 0, autoPause = false;

// 선택 API 호출 — 없으면 console.warn 1회(error 아님, §8 콘솔 error 0 유지)
const warned = new Set();
function call(mod, name, ...args) {
  const f = mod[name];
  if (typeof f === 'function') return f(...args);
  if (!warned.has(name)) { warned.add(name); console.warn(`[hanbut] missing API: ${name}`); }
  return undefined;
}

function showBootError(key, obj) {
  const el = $('lobby-msg');
  if (!el) return;
  setText(el, key, obj); el.hidden = false;
}

// 오버레이 닫기 = 각 소유 모듈의 페이드 닫기(hud.hidePause·cards.hideResult·cards.hidePackDone)
function closeOverlays(keep) {
  if (keep !== 'overlay-pause') call(hud, 'hidePause');
  if (keep !== 'result') call(cards, 'hideResult');
  if (keep !== 'packdone') call(cards, 'hidePackDone');
}

function onState({ from, to }) {
  if (to === 'idle') { closeOverlays(); play.hidden = true; lobbyEl.hidden = false; lobby.renderLobby(); }
  else if (to === 'level_in') { closeOverlays(); lobbyEl.hidden = true; play.hidden = false; call(render, 'resize'); }
  else if (to === 'playing' && from === 'paused') call(hud, 'hidePause');
  else if (to === 'paused') { hud.showPause(autoPause); autoPause = false; }
  else if (to === 'pack_done') closeOverlays('packdone');
}

function wire() {
  const v = () => game.view();
  const remain = () => hud.setRemain(v().remain);
  game.on('state', onState);
  game.on('levelIn', e => {
    hud.slideIn(e.dir); hud.setLevelLabel(Math.ceil(e.L / 10), e.L);
    call(hud, 'setFirstRun', e.L === 1 && game.progress().maxClearedLevel === 0);   // 최초 L1: ⏸만 표시
    remain(); hud.setStreak(v().streak); call(render, 'resize');
  });
  game.on('push', e => { call(fx, 'inkFill', e.cell); call(audio, 'push', e.idx); call(hud, 'revealChrome'); remain(); });
  game.on('pop', e => { call(fx, 'inkAbsorb', e.cell); call(audio, 'pop', e.idx); remain(); });
  game.on('cut', e => { call(fx, 'inkAbsorb', e.to); remain(); });
  game.on('reset', () => { call(fx, 'inkAbsorb', v().head); remain(); });
  game.on('invalid', e => { call(fx, 'pulseRing', e.cell); call(fxClear, 'shake', board); });   // 규칙 5: 격자 ±8px 흔들림 + S 맥동(막힘음은 막다른 길 전용)
  game.on('deadend', e => { call(fx, 'dangerPulse', v().head, e.remain); call(audio, 'blocked'); call(audio, 'vibrate', 30); call(hud, 'shakeRemain'); });
  game.on('hint', e => {
    if (e.cells) call(fx, 'hintDots', e.cells);
    else { call(fx, 'hintRing', e.backCell); hud.showToast('hintBack'); }
  });
  game.on('hintReady', () => hud.showHintButton());
  game.on('ghost', e => fx.setGhost(e.on));
  game.on('clear', e => { call(fxClear, 'clearWave', e.path); call(fxClear, 'confetti', e.path); call(audio, 'clear'); });   // 인게임 클리어는 흔들림 없음(§3)
  game.on('result', res => { cards.fillResult(res); hud.setStreak(res.streak); });
  game.on('packDone', e => cards.fillPackDone(e.k, store.loadProgress()));
  game.on('packShutter', e => { audio.shutter(); cards.revealPhoto(e.k); lobby.renderPackCards(); });
}

function frame(now) {
  const raw = last ? now - last : 16.7; last = now;
  const dt = Math.min(raw, 50) * clock.speed;            // 탭 복귀·GC 스파이크 50ms 클램프
  clock.t += dt;
  game.tick(dt);
  fx.tick(dt);
  hud.tick(dt);
  if (!play.hidden) render.draw(game.view(), fx.list());  // idle(로비)은 draw 생략
  requestAnimationFrame(frame);
}

function listen() {
  document.addEventListener('pointerdown', audio.unlock);   // once 아님 — running 되면 audio.unlock이 스스로 제거
  document.addEventListener('keydown', audio.unlock);
  document.addEventListener('hanbut:settings', e => call(audio, 'applySettings', e.detail));   // 로비·일시정지 토글 공용
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      input.cancel();                                         // 활성 포인터 = pointercancel 동일 처리
      autoPause = true;
      if (!game.dispatch({ type: 'pause' })) autoPause = false;  // playing 외에는 불허 — rAF 정지로 타이머만 동결
    } else last = 0;                                          // 복귀 dt 스파이크 차단
  });
  const onResize = () => { if (!play.hidden) call(render, 'resize'); };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  document.addEventListener('touchmove', e => { if (!play.hidden) e.preventDefault(); }, { passive: false });
}

async function boot() {
  // ① 토큰
  const T = render.readTokens() || {};
  const missing = Object.keys(T).filter(k => !T[k]);
  if (missing.length) { for (const m of missing) console.error(`[hanbut] token missing: ${m}`); showBootError('loadError'); return; }
  // ② 저장값
  const settings = store.loadSettings();
  const progress = store.loadProgress();
  call(audio, 'applySettings', settings);
  // ③ 레벨 로드·검증
  let res;
  try { res = await levels.loadLevels('./levels.json', 'levels'); }
  catch (err) { console.warn('[hanbut] levels load failed', err); showBootError('loadError'); return; }
  if (!res || res.ok === false) {
    if (res && res.id) showBootError('dataError', { id: res.id }); else showBootError('loadError');
    return;
  }
  const list = Array.isArray(res) ? res : res.levels;
  // ④ 게임
  game = createGame(list, progress);
  const dispatch = game.dispatch;
  // ⑤ UI init 주입 + 이벤트 배선
  input.init({ board, dispatch, cellAt: render.cellAt, cellSize: typeof render.cellSize === 'function' ? render.cellSize : undefined });
  keys.init({ dispatch, board, sheetOpen: lobby.sheetOpen });
  hud.init({ dispatch, clock });
  cards.init({ dispatch, levels: list });
  lobby.init({ dispatch, store, levels: list, onWipe: p => game.setProgress(p) });   // 진행 초기화 → game 메모리도 교체
  wire();
  // ⑥ 로비
  play.hidden = true; lobbyEl.hidden = false;
  lobby.renderLobby();
  performance.mark('hanbut:ready');
  // ⑦ 리스너
  listen();
  // ⑧ 테스트 훅
  installHook({ game, clock, board, play, levelsJson: res.json || res.data || res, wipe: () => { lobby.wipe(); return true; } });
  // ⑨ 루프
  requestAnimationFrame(frame);
}

boot();
