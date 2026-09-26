// main.js — 완성 1차: boot(Matter 5000ms 폴링 + content Promise.all → S1) → 화면 라우팅, rAF 고정 스텝 루프, resize 재그리기
import * as game from './game.js';
import { install } from './debug.js';
import { loadTheme, safeTop } from './theme.js';
import * as contentMod from './content.js';
import { h } from './dom.js';
import strings from './strings.js';

// STEP=1000/60, MAX=4 (§2 규칙 4), speed = main 지역 배율(기본 1). debug는 loop.setSpeed(m)로만 바꾼다
const STEP = 1000 / 60, MAX = 4;
let last = performance.now(), acc = 0, raf = 0, speed = 1, shown = '';
let content = null;   // contentMod.load() 결과 {wishes, trails}: 6단계 lobby·result가 pick(content, set)으로 쓴다
const loop = { setSpeed(m) { speed = m; }, getSpeed() { return speed; } };
const ROOTS = ['boot', 'error', 'lobby', 'game', 'result'];
const ROOT_OF = { boot: 'boot', error: 'error', lobby: 'lobby', result: 'result' };   // 나머지(aim…paused) = game

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25); last = now;
  if (game.running()) {                       // aim·drop·settle·hold 에서만
    acc += dt * 1000 * speed; let n = 0;
    while (acc >= STEP && n < MAX * speed) { game.step(); acc -= STEP; n++; }
    if (acc >= STEP) acc = 0;                 // 4스텝 초과 잔여분 폐기 → 슬로모션, 시간 도약 없음
  }
  game.frame(dt, now);                        // 카메라·하늘·fx.update(dt)·scene.draw()
  route(game.state());
  raf = requestAnimationFrame(frame);
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

function paintBoot() {
  const el = document.getElementById('boot');
  if (!el) return;
  const stones = h('div', { class: 'boot-stones', 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) stones.appendChild(h('span', { class: 'boot-stone' }));
  el.replaceChildren(h('div', { class: 'pol-brand' }, '돌탑'), stones, h('p', { class: 'boot-msg' }, strings.boot.loading));
}

function paintError() {
  const el = document.getElementById('error');
  if (!el) return;
  const btn = h('button', { class: 'pol-btn-primary', type: 'button' }, strings.error.retry);
  btn.addEventListener('click', () => location.reload());
  el.replaceChildren(h('h1', { class: 'err-title' }, strings.error.load), h('p', { class: 'err-hint' }, strings.error.hint), btn);
}

function stageCanvas() {
  let cv = document.getElementById('stage');
  if (!cv) {
    cv = h('canvas', { id: 'stage', 'aria-hidden': 'true' });
    document.getElementById('game').appendChild(cv);
  }
  return cv;
}

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
    if (!raf || game.state() === 'paused') game.frame(0, performance.now());
  });
}

async function boot() {
  install({ game, loop });
  paintBoot();
  route('boot');
  loadTheme();
  game.init(stageCanvas());
  game.resize(innerWidth, innerHeight, safeTop());
  const [ok, c] = await Promise.all([waitMatter(5000), contentMod.load()]);
  content = c;
  if (!ok) {
    paintError();
    game.setScreen('error');
    route('error');
    return;
  }
  game.setScreen('lobby');
  route('lobby');
  last = performance.now(); acc = 0;
  raf = requestAnimationFrame(frame);
}

addEventListener('resize', onResize);
boot();
