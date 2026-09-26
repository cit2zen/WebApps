// main.js — 완성 2차: boot(Matter 5000ms 폴링 + content Promise.all → S1) → 화면 라우팅, rAF 고정 스텝 루프(start/stop),
// resize 재그리기, 입력(input·keys)·visibilitychange 배선 + 6단계 로비·대화상자·결과 mount와 UI 콜백(cb)·game 훅
import * as game from './game.js';
import * as input from './input.js';
import * as keys from './keys.js';
import { install, pickSet } from './debug.js';
import { loadTheme, safeTop } from './theme.js';
import * as contentMod from './content.js';
import { h } from './dom.js';
import * as lobby from './lobby.js';
import * as dialogs from './dialogs.js';
import * as result from './result.js';

// STEP=1000/60, MAX=4 (§2 규칙 4), speed = main 지역 배율(기본 1). debug는 loop.setSpeed(m)로만 바꾼다
const STEP = 1000 / 60, MAX = 4;
let last = performance.now(), acc = 0, raf = 0, speed = 1, shown = '', on = false;
let content = null;   // contentMod.load() 결과 {wishes, trails}: 6단계 lobby·result가 pick(content, set)으로 쓴다
// stop/start = game의 일시정지·재개(cancelAnimationFrame 뒤 마지막 프레임 유지 / last=now·acc=0 뒤 rAF)
const loop = {
  setSpeed(m) { speed = m; },
  getSpeed() { return speed; },
  start() {
    if (on) return;
    on = true; last = performance.now(); acc = 0;
    raf = requestAnimationFrame(frame);
  },
  stop() { on = false; cancelAnimationFrame(raf); raf = 0; },
  active() { return on; },
};
const ROOTS = ['boot', 'error', 'lobby', 'game', 'result'];
const ROOT_OF = { boot: 'boot', error: 'error', lobby: 'lobby', result: 'result' };   // 나머지(aim…paused) = game

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25); last = now;
  if (game.running()) {                       // aim·drop·settle·hold 에서만
    acc += dt * 1000 * speed; let n = 0;
    while (acc >= STEP && n < MAX * speed && game.running()) { game.step(); acc -= STEP; n++; }
    if (acc >= STEP) acc = 0;                 // 4스텝 초과 잔여분 폐기 → 슬로모션, 시간 도약 없음
  }
  input.poll(now); keys.poll(dt);             // 회전 홀드 반복(350ms 후 150ms), 좌우 키 가속
  game.frame(dt, now);                        // hud.poll·카메라·하늘·fx.update(dt)·scene.draw()
  route(game.state());
  if (on) raf = requestAnimationFrame(frame);
}

// 화면 루트 1개만 보인다(hidden 속성 = DOM 프로퍼티, CSP 무관)
function route(state) {
  const id = ROOT_OF[state] || 'game';
  if (id === shown) return;
  shown = id;
  for (const r of ROOTS) {
    const el = document.getElementById(r);
    if (el) el.hidden = r !== id;
  }
}

function stageCanvas() {
  let cv = document.getElementById('stage');
  if (!cv) {
    cv = h('canvas', { id: 'stage', 'aria-hidden': 'true' });
    document.getElementById('game').appendChild(cv);
  }
  return cv;
}

// ── v6: 화면 내용 채우기 + UI 콜백(cb). 표시 전환은 frame의 route(game.state())가 맡고 여기서는 즉시 1회 반영한다 ──
function showLobby() {
  dialogs.closeAll(); game.setScreen('lobby'); lobby.show(content);
  route(game.state()); loop.start();              // S9a 나가기는 일시정지(loop.stop) 상태에서 온다
}
function showResult() { dialogs.closeAll(); result.show({ ...game.summary(), content }); route(game.state()); }
let lastOpt = {};
const cb = {
  onStart(mode, o = {}) {                         // o = {day?, seed?, friendCm?}
    lastOpt = o; dialogs.closeAll();
    const p = pickSet(mode, o);                   // official 다운그레이드·random 시드(C v4 pickSet)
    game.start(p.mode, p.set, { friendCm: o.friendCm ?? null });
    route(game.state());                          // #game을 바로 보여 준다(뒤따르는 S2→S7 토스트가 #game에 붙도록)
  },
  onResume() { game.resume(); },                  // v5 resume이 loop.start()로 last·acc를 다시 잡는다
  onLeave() { game.leave(); showLobby(); },
  onShare() { return result.share(); },
  onRetry() {                                     // 같은 모드·같은 날짜(랜덤은 같은 시드)·같은 친구 기록
    const s = game.summary(), o = { day: s.set.day, friendCm: lastOpt.friendCm ?? null };
    if (s.mode === 'random') o.seed = s.set.seed;
    cb.onStart(s.mode, o);
  },
  onSetting(field, v) { game.setting(field, v); },
};

// defer 순서상 이미 결정됐지만, rAF로 window.Matter를 최대 ms 동안 폴링한다
function waitMatter(ms) {
  const t0 = performance.now();
  return new Promise(res => {
    const tick = () => {
      if (window.Matter) return res(true);
      if (performance.now() - t0 >= ms) return res(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// 연속 resize는 rAF 1회로 합친다. fitCanvas·theme·layout 재계산 뒤, 루프가 멈췄거나 paused면 1회 다시 그린다
let rz = 0;
function onResize() {
  if (rz) return;
  rz = requestAnimationFrame(() => {
    rz = 0;
    loadTheme();
    game.resize(innerWidth, innerHeight, safeTop());
    if (!loop.active() || game.state() === 'paused') game.frame(0, performance.now());
  });
}

// 탭 숨김 → paused + AudioContext suspend. 다시 보여도 자동 재개하지 않는다
function onVisibility() {
  if (document.visibilityState === 'hidden') game.onHidden();
}

async function boot() {
  install({ game, loop });
  lobby.showBoot();
  route('boot');
  loadTheme();
  game.init(stageCanvas(), { loop, markAim: input.markAim });
  game.resize(innerWidth, innerHeight, safeTop());
  const [ok, c] = await Promise.all([waitMatter(5000), contentMod.load()]);
  content = c;
  if (!ok) {
    lobby.showError();
    game.setScreen('error');
    route('error');
    return;
  }
  input.init({
    stage: stageCanvas(), rotCw: game.hudEl('rotCw'), rotCcw: game.hudEl('rotCcw'),
    onAction: game.onAction, getAim: game.aimInfo, onHint: game.cancelHint,
  });
  keys.init({ getEnv: () => ({ state: game.state(), dialog: game.dialogTop() }), onAction: game.onAction });
  document.addEventListener('visibilitychange', onVisibility);
  showLobby();
}

lobby.mount(cb); dialogs.mount(cb); result.mount(cb);
game.setHooks({
  today: () => lobby.activateToday(performance.now()),
  share: () => result.share(), retry: () => cb.onRetry(),
  closeTop: dialogs.closeTop,
  dialogTop: () => (dialogs.topId() === 'dlg-pause' ? 'S9' : dialogs.topId()),
  pause: info => dialogs.openPause(info), resume: () => dialogs.closePause(),
  result: () => showResult(), lobby: () => { if (game.state() === 'lobby') lobby.show(content); },
  shareText: result.shareText, forceShare: result.forceShare, sound: dialogs.syncSound,
});
addEventListener('resize', onResize);
boot();
