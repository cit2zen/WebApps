// ✂️ 분해 카드 — 등장 일정, 톡해서 부품 카드로 나누기, 놓침·오답 처리
import { $, wait, flash } from './dom.js';
import { binById, stageOf } from './data.js';
import { G, canInput, pause, unpause, binElOf, centerOf } from './state.js';
import { makeEntity, attach, beltWidth, removeEntity } from './belt.js';
import { wireEntity } from './input.js';
import { onBreak, SPLIT_BONUS } from './scoring.js';
import { takeHit } from './powerups.js';
import { renderHud, popScore, popHearts } from './hud.js';
import { burst, floatText, shake } from './fx.js';
import { toast, hideToast } from './sheet.js';
import { explainCombo } from './explain.js';
import { sfx } from './audio.js';
import { josa } from './strings.js';
import { endCoach, finish } from './play.js';
import { emit } from './events.js';

const FIRST_AT = [18, 24];     // 첫 분해 카드(초)
const EVERY = [20, 28];        // 그다음 간격
const SPLIT_EVERY = [9, 11];   // 오늘의 규칙 '분해 러시'
const NOW_SHARE = 0.65;        // 단계 모드: 현재 단계 분해 카드 우선
const PART_MIN_X = 0.35;       // 첫 부품 카드는 분해한 자리 또는 이 비율(벨트 폭)보다 오른쪽 — 남는 카드는 오른쪽 밖에서 들어와요

const span = ([a, b], rng) => a + rng() * (b - a);
export const firstComboAt = (rng = Math.random) => span(FIRST_AT, rng);
export const nextComboAt = (S) => S.elapsed + span(S.mod === 'split' ? SPLIT_EVERY : EVERY, S.rng);

function pickCombo(S) {
  const onBelt = new Set(S.ents.filter((e) => !e.gone && e.kind === 'combo').map((e) => e.combo.id));
  let pool = S.combos.filter((c) => !onBelt.has(c.id));
  const now = pool.filter((c) => stageOf(c) === S.stage);
  if (S.mode === 'stage' && now.length && S.rng() < NOW_SHARE) pool = now;
  return pool.length ? pool[Math.floor(S.rng() * pool.length)] : null;
}

/** 벨트 오른쪽 끝에 분해 카드 올리기 */
export function spawnCombo(S) {
  S.comboAt = nextComboAt(S);
  const combo = pickCombo(S);
  if (!combo) return null;
  const ent = makeEntity('combo', combo, S.stage);
  attach(ent, beltWidth());
  wireEntity(ent);
  S.ents.push(ent);
  return ent;
}

/** 톡/스페이스 — 부품 카드로 나눔 */
export function doSplit(ent) {
  const S = G.S;
  if (!S || !canInput() || !ent || ent.gone || ent.kind !== 'combo') return false;
  if (S.pause.has('coach')) endCoach();
  const combo = ent.combo;
  const c = centerOf(ent.node);
  ent.gone = true;
  removeEntity(ent, 'poof');
  S.score += SPLIT_BONUS;
  sfx('split');
  emit('split', { combo });
  burst(c.x, c.y, 'var(--sun)', 18);
  floatText(c.x, c.top, `✂️ +${SPLIT_BONUS}`, 'is-small');
  const step = (S.cardW || ent.w) + 12;
  let x = Math.max(ent.x, beltWidth() * PART_MIN_X); // 구덩이 쪽으로 당기지 않음 (겹침은 move()가 밀어냄)
  for (const part of combo.parts) {
    const p = makeEntity('item', part, S.stage);
    attach(p, x);
    wireEntity(p);
    flash(p.node, 'is-tap');
    S.ents.push(p);
    x += step;
  }
  popScore();
  renderHud(S);
  return true;
}

const partLines = (combo) => combo.parts.map((p) => `${p.emoji || ''} ${p.name} → ${binById(p.bin).name}`).join(' · ');
const pushMistakes = (S, combo) => { for (const p of combo.parts) S.mistakes.push({ kind: 'item', item: p, combo: combo.id }); };

/** 나누지 않은 분해 카드가 구덩이로 */
export function comboMiss(S, ent) {
  const combo = ent.combo;
  const lost = takeHit(S);
  S.missed += 1;
  onBreak(S);
  pushMistakes(S, combo);
  sfx('miss');
  emit('miss', { item: combo, combo: true });
  if (lost) popHearts();
  toast([`${combo.emoji || '📦'} ${josa(combo.name, '은/는')} 분해해서 버려요`, partLines(combo)], 2600);
  renderHud(S);
  if (S.hearts <= 0) {
    pause('end');
    wait(650).then(() => { if (G.S === S) finish(false); });
  }
}

/** 나누지 않고 수거함에 넣음 */
export async function comboWrong(S, ent, binId) {
  const combo = ent.combo;
  ent.gone = true;
  const lost = takeHit(S);
  S.wrong += 1;
  onBreak(S);
  pushMistakes(S, combo);
  sfx('wrong');
  emit('wrong', { item: combo, binId, skippedAct: false, combo: true });
  hideToast();
  const binEl = binElOf(binId);
  if (binEl) flash(binEl, 'is-wrong');
  flash(ent.node, 'is-shake');
  shake($('#play'));
  if (lost) popHearts();
  renderHud(S);
  pause('sheet');
  await wait(380);
  removeEntity(ent, 'poof');
  await explainCombo(combo);
  if (G.S !== S) return;
  unpause('sheet');
  if (S.hearts <= 0) finish(false);
}
