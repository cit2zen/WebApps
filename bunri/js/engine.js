// 게임 루프 — rAF + dt, 타이머, 속도 상승, 카드 생성, 이동, 놓침, 보너스·아이템 일정
import { $, reducedMotion } from './dom.js';
import { actOf } from './data.js';
import { store } from './storage.js';
import { G } from './state.js';
import { makeEntity, attach, place, beltWidth, setActive } from './belt.js';
import { miss, runBonus } from './actions.js';
import { bonusTick } from './bonus.js';
import { pickPower, nextPowerAt, renderPower } from './powerups.js';
import { spawnCombo } from './split.js';
import { rushTick, endRush, rushSpeed, rushGap } from './rush.js';
import { renderHud } from './hud.js';
import { wireEntity } from './input.js';
import { countTick, finish } from './play.js';
import { emit } from './events.js';

/** t0→t1: 벨트를 가로지르는 시간(초) · gap: 카드 사이 최소 간격(초) · ramp: 속도가 최고에 이르는 시간 */
export const CFG = {
  1: { maxOn: 2, t0: 9, t1: 6, gap0: 3.2, gap1: 2.3, time: 60, ramp: 60 },
  2: { maxOn: 3, t0: 7.5, t1: 4.8, gap0: 2.4, gap1: 1.7, time: 60, ramp: 60 },
  3: { maxOn: 4, t0: 6.5, t1: 4.0, gap0: 2.0, gap1: 1.4, time: 60, ramp: 60 },
  4: { maxOn: 4, t0: 6.5, t1: 3.2, gap0: 2.0, gap1: 1.15, time: 0, ramp: 150 },
};
const MIN_T = 2.6;
const DANGER_X = 0.22; // 맨 앞 카드가 벨트 폭의 22%보다 왼쪽이면 위험

/** 벨트 위 분류 대상(일반 카드·분해 카드) */
export const isCard = (e) => !e.gone && (e.kind === 'item' || e.kind === 'combo');

const lerp = (a, b, p) => a + (b - a) * p;
function speedNow(S) {
  const c = S.cfg;
  const p = Math.min(S.mode === 'endless' ? 1.35 : 1, S.elapsed / c.ramp);
  return { T: Math.max(MIN_T, lerp(c.t0, c.t1, p)), gap: Math.max(0.9, lerp(c.gap0, c.gap1, p)) };
}

/** 카드 하나를 벨트 오른쪽 끝(또는 x)에 올림 */
export function spawn(S, x = null, noAct = false) {
  const live = S.ents.filter((e) => !e.gone && e.kind === 'item');
  const onBelt = (it) => live.some((e) => e.item.id === it.id) || (noAct && actOf(it));
  const item = S.pick(onBelt);
  if (!item) return null;
  const ent = makeEntity('item', item, S.stage);
  store.markSeen(item.id);
  if (S.review && S.review.failed.has(item.id)) S.review.glow.add(item.id);
  attach(ent, x == null ? beltWidth() : x);
  wireEntity(ent);
  S.ents.push(ent);
  return ent;
}

function spawnPower(S) {
  const ent = makeEntity('power', pickPower(S), S.stage);
  attach(ent, beltWidth());
  wireEntity(ent);
  S.ents.push(ent);
}

export function refreshActive(S) {
  let a = null;
  for (const e of S.ents) if (isCard(e) && (!a || e.x < a.x)) a = e;
  if (a !== S.active) { setActive(S.active, a); S.active = a; }
  const it = a && a.kind === 'item' ? a.item : null;
  const glow = !!(it && S.review && S.review.glow.has(it.id));
  const hintBin = it && (S.hint > 0 || glow) ? it.bin : null;
  if (hintBin !== S.hintBin) {
    for (const b of G.binEls) b.classList.toggle('is-hint', b.dataset.bin === hintBin);
    S.hintBin = hintBin;
  }
  if (it && S.hint > 0) a.hinted = true;
}

/** danger{on} — 맨 앞 카드가 구덩이에 가까움 (바뀔 때만) */
export function setDanger(S, on) {
  if (S.danger === on) return;
  S.danger = on;
  $('#play').classList.toggle('is-danger', on);
  emit('danger', { on });
}
const dangerTick = (S, W) => setDanger(S, !!(S.active && !S.active.held && S.active.x < W * DANGER_X));

function move(S, dt, W, v) {
  const live = S.ents.filter((e) => !e.gone).sort((a, b) => a.x - b.x);
  let prevEnd = -Infinity;
  const fallen = [];
  for (const e of live) {
    if (!e.held) e.x = Math.max(e.x - v * dt, prevEnd + 12);
    prevEnd = e.x + e.w;
    if (!e.held && e.x <= 2) fallen.push(e);
    else place(e);
  }
  for (const e of fallen) miss(e);
  if (!reducedMotion()) {
    S.dist += v * dt;
    $('#belt-band').style.backgroundPositionX = `${(-(S.dist % 44)).toFixed(1)}px`;
  }
  return live.filter((e) => !e.gone);
}

function maybeSpawn(S, live, W, vBase, gap) {
  if (S.review && !S.review.pending.length) {
    if (!live.some(isCard)) finish(true);
    return;
  }
  // 황금 비(golden): 황금 아이템은 카드 수 제한(maxOn)을 1장 넘어도 나옴
  if (live.length >= S.cfg.maxOn + (S.mod === 'golden' && S.elapsed >= S.powerAt ? 1 : 0)) return;
  const last = live.reduce((m, e) => (!m || e.x > m.x ? e : m), null);
  if (last && W - last.x < Math.max(S.cardW + 20, vBase * gap)) return;
  if (S.elapsed >= S.powerAt) { spawnPower(S); S.powerAt = nextPowerAt(S.elapsed, S.rng, S.mod === 'golden'); return; }
  if (S.elapsed >= S.comboAt) { if (spawnCombo(S)) return; }
  const e = spawn(S);
  if (e) S.cardW = e.w;
}

/** 한 프레임 */
export function frame(dt) {
  const S = G.S;
  if (!S || S.over) return;
  if (S.pause.size) {
    if (S.pause.size === 1 && S.pause.has('bonus')) bonusTick(dt);
    if (S.pause.size === 1 && S.pause.has('count')) countTick(S, dt);
    return;
  }
  S.elapsed += dt;
  if (S.timeMax) {
    S.timeLeft -= dt;
    if (S.timeLeft <= 0) { renderHud(S); endRush(S); finish(true); return; }
  }
  rushTick(S, dt);
  if (S.feverLeft > 0) {
    S.feverLeft = Math.max(0, S.feverLeft - dt);
    if (S.feverLeft === 0) emit('fever', { on: false });
  }
  if (S.slowLeft > 0) S.slowLeft = Math.max(0, S.slowLeft - dt);

  const W = beltWidth();
  const { T, gap } = speedNow(S);
  const vBase = (W / T) * rushSpeed(S);
  const live = move(S, dt, W, vBase * (S.slowLeft > 0 ? 0.5 : 1));
  if (G.S !== S || S.over) return;
  if (!S.pause.size) maybeSpawn(S, live, W, vBase, gap * rushGap(S));
  if (G.S !== S || S.over) return;
  S.ents = S.ents.filter((e) => !e.gone);
  refreshActive(S);
  dangerTick(S, W);
  renderHud(S);
  renderPower(S);
  if (S.bonusAt.length && S.elapsed >= S.bonusAt[0] && S.quiz.length) {
    S.bonusAt.shift();
    runBonus(S.quiz.pop());
  }
}

let raf = 0;
export function startLoop() {
  stopLoop();
  let last = performance.now();
  const step = (t) => {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    frame(dt);
    raf = G.S && !G.S.over ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
}

export function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

