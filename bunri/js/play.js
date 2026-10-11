// 플레이 — 판 시작/끝, 수거함, 카운트다운, 코치, 일시정지
import { $, el } from './dom.js';
import { binsForStage } from './data.js';
import { store } from './storage.js';
import { G, pause, unpause, binElOf } from './state.js';
import { spawn, refreshActive, startLoop, stopLoop, setDanger } from './engine.js';
import { buildRun, resultOf } from './modes.js';
import { endRush } from './rush.js';
import { beltWidth, clearBelt } from './belt.js';
import { renderPower } from './powerups.js';
import { closeBonus } from './bonus.js';
import { showCoach, hideCoach } from './coach.js';
import { renderHud, resetHud } from './hud.js';
import { sortActive } from './actions.js';
import { KEYS } from './input.js';
import { openDialog, hideToast, dialogOpen } from './sheet.js';
import { sfx } from './audio.js';
import { emit } from './events.js';

const COUNT = ['3', '2', '1', '시작!'];
const COUNT_STEP = 0.7;

function renderBins(stage) {
  const list = binsForStage(stage);
  const box = $('#bins');
  box.dataset.count = String(list.length);
  G.binEls = list.map((b, i) => el('button', {
    class: 'bin', type: 'button', 'data-bin': b.id, style: `--c:var(--bin-${b.id})`,
    'aria-label': b.full + (KEYS[i] ? ` (${KEYS[i]})` : ''),
    on: { click: () => sortActive(b.id) },
  }, [
    el('span', { class: 'bin-lid', 'aria-hidden': 'true' }),
    el('span', { class: 'bin-body' }, el('span', { class: 'bin-label' }, [
      el('span', { class: 'bin-emoji', 'aria-hidden': 'true', text: b.emoji }),
      el('span', { class: 'bin-name', text: b.name }),
    ])),
    KEYS[i] ? el('span', { class: 'bin-key', 'aria-hidden': 'true', text: KEYS[i] }) : null,
  ]));
  box.replaceChildren(...G.binEls);
}

/** 게임 시작 — run: 숫자(1–3 단계, 4 무한) 또는 { mode:'stage'|'endless'|'daily'|'review', stage, ids?, daily? } · 시작할 수 없으면 false */
export function startPlay(run, hooks) {
  const S = buildRun(run);
  if (!S) return false;
  if (G.S && !G.S.over) { G.S.over = true; teardown(G.S); }
  G.hooks = hooks || {};
  G.S = S;
  clearBelt();
  hideCoach();
  closeBonus();
  resetHud();
  renderBins(S.stage);
  const playEl = $('#play');
  playEl.classList.remove('is-fever', 'is-rush', 'is-danger');
  $('#rush-banner').hidden = true;
  playEl.dataset.stage = String(S.stage);
  playEl.dataset.mode = S.mode;
  if (S.mod) playEl.dataset.mod = S.mod; else delete playEl.dataset.mod;
  renderHud(S);
  renderPower(S);
  startLoop();
  emit('run:start', { mode: S.mode, stage: S.stage });
  return true;
}

/** 카운트다운 — 루프가 'count'만 남았을 때 부름 */
export function countTick(S, dt) {
  S.countT += dt;
  const idx = Math.floor(S.countT / COUNT_STEP);
  const n = $('#countdown');
  if (idx !== S.countIdx && idx < COUNT.length) {
    S.countIdx = idx;
    n.hidden = false;
    n.textContent = COUNT[idx];
    n.classList.remove('tick');
    void n.offsetWidth;
    n.classList.add('tick');
    sfx(idx < 3 ? 'tick' : 'go');
  }
  if (S.countT >= COUNT.length * COUNT_STEP - 0.2) {
    n.hidden = true;
    unpause('count');
    if (S.coach) startCoach(S);
  }
}

function startCoach(S) {
  const W = beltWidth();
  const ent = spawn(S, Math.max(0, W / 2 - 52), true);
  if (!ent) return;
  pause('coach');
  refreshActive(S);
  requestAnimationFrame(() => {
    if (G.S === S && S.pause.has('coach')) showCoach(ent.node, binElOf(ent.item.bin), endCoach);
  });
}

export function endCoach() {
  store.setCoached();
  hideCoach();
  if (G.S) { G.S.coach = false; unpause('coach'); }
}

function teardown(S) {
  if (S) { endRush(S); setDanger(S, false); }
  stopLoop();
  closeBonus();
  hideCoach();
  hideToast();
  clearBelt();
  $('#countdown').hidden = true;
  $('#play').classList.remove('is-fever', 'is-rush', 'is-danger');
  for (const b of G.binEls) b.classList.remove('is-hint', 'is-hover');
}

export function finish(success) {
  const S = G.S;
  if (!S || S.over) return;
  S.over = true;
  G.S = null;
  teardown(S);
  const r = resultOf(S, success);
  sfx(success || r.endless || r.mode === 'review' ? 'clear' : 'fail');
  emit('run:end', r);
  if (G.hooks.onEnd) G.hooks.onEnd(r);
}

/** ✕ / Esc / 화면 숨김 — 벨트를 멈추고 계속할지 물음 */
export async function pauseMenu() {
  const S = G.S;
  if (!S || S.over || dialogOpen() || S.pause.has('menu')) return;
  pause('menu');
  const v = await openDialog([
    el('span', { class: 'sheet-badge is-help', text: '⏸ 일시정지' }),
    el('h2', { class: 'sheet-title', text: '잠깐 쉬어요' }),
    el('p', { class: 'sheet-why', text: '처음으로 가면 이번 판 점수는 저장되지 않아요.' }),
  ], [
    { label: '처음으로', value: 'home' },
    { label: '계속하기', value: 'resume', primary: true },
  ], { dismiss: 'resume', label: '일시정지' });
  if (G.S !== S) return;
  if (v === 'home') {
    S.over = true;
    G.S = null;
    teardown(S);
    emit('run:exit', { mode: S.mode, stage: S.stage });
    if (G.hooks.onExit) G.hooks.onExit();
  } else {
    unpause('menu');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.S && !G.S.over && !dialogOpen()) pauseMenu();
});
