// 판정 — 분류(정답/오답/손질 누락), 놓침, 손질, 황금 아이템, 보너스 OX
import { $, wait, flash } from './dom.js';
import { binById, actOf } from './data.js';
import { G, canInput, pause, unpause, binElOf, centerOf } from './state.js';
import { removeEntity, markActDone } from './belt.js';
import { onCorrect, onBreak, isComboMilestone, ACT_BONUS, BONUS_OX } from './scoring.js';
import { applyPower, takeHit } from './powerups.js';
import { doSplit, comboMiss, comboWrong } from './split.js';
import { openBonus } from './bonus.js';
import { renderHud, popScore, popHearts } from './hud.js';
import { burst, floatText, shake, bigPop } from './fx.js';
import { toast, hideToast } from './sheet.js';
import { explainItem, explainPrep, explainQuiz } from './explain.js';
import { sfx } from './audio.js';
import { pick, CORRECT_WORDS } from './strings.js';
import { endCoach, finish } from './play.js';
import { emit } from './events.js';

function resolve(S, ent) {
  if (ent.hinted) S.hint = Math.max(0, S.hint - 1);
  ent.gone = true;
}

/** 엔티티를 수거함에 넣기 — 받아들였으면 true */
export function sortEntity(ent, binId) {
  const S = G.S;
  if (!S || !canInput() || !ent || ent.gone || (ent.kind !== 'item' && ent.kind !== 'combo')) return false;
  if (S.pause.has('coach')) endCoach();
  if (ent.kind === 'combo') { comboWrong(S, ent, binId); return true; }
  const item = ent.item;
  const act = actOf(item);
  if (binId === item.bin && (!act || ent.actDone)) correct(S, ent, binElOf(binId));
  else wrong(S, ent, binId, binId === item.bin ? act : null);
  return true;
}

export function sortActive(binId) {
  const S = G.S;
  return !!S && sortEntity(S.active, binId);
}

/** 복습: 틀리거나 놓친 카드는 대기열 뒤로 */
function requeue(S, item) {
  if (!S.review) return;
  S.review.failed.add(item.id);
  S.review.pending.push(item);
}

function correct(S, ent, binEl) {
  resolve(S, ent);
  if (S.review && !S.review.failed.has(ent.item.id)) S.review.cleared.add(ent.item.id);
  const { pts, feverStart } = onCorrect(S);
  sfx('correct', 1 + Math.min(S.combo, 20) * 0.035);
  removeEntity(ent, 'fly', binEl);
  if (binEl) {
    flash(binEl, 'gulp');
    const c = centerOf(binEl);
    burst(c.x, c.y, `var(--bin-${ent.item.bin})`);
    floatText(c.x, c.top - 6, `+${pts}`);
  }
  popScore();
  emit('correct', { item: ent.item, pts, combo: S.combo, fever: S.feverLeft > 0 });
  if (feverStart) { bigPop('FEVER!', true); sfx('fever'); emit('fever', { on: true }); }
  else if (isComboMilestone(S.combo)) { bigPop(`콤보 ${S.combo}!`); emit('combo', { combo: S.combo }); }
  const prep = ent.item.prep || [];
  toast([`${pick(CORRECT_WORDS)} +${pts}`, ...prep], 1300);
  renderHud(S);
}

async function wrong(S, ent, binId, skippedAct) {
  resolve(S, ent);
  const item = ent.item;
  const bin = binById(item.bin);
  const lost = takeHit(S);
  S.wrong += 1;
  onBreak(S);
  requeue(S, item);
  S.mistakes.push({ kind: 'item', item });
  sfx('wrong');
  emit('wrong', { item, binId, skippedAct: !!skippedAct });
  hideToast();
  const binEl = binElOf(binId);
  if (binEl && !skippedAct) flash(binEl, 'is-wrong');
  flash(ent.node, 'is-shake');
  shake($('#play'));
  if (lost) popHearts();
  renderHud(S);
  pause('sheet');
  await wait(380);
  removeEntity(ent, 'poof');
  await (skippedAct ? explainPrep(item, bin, skippedAct) : explainItem(item, bin));
  if (G.S !== S) return;
  unpause('sheet');
  if (S.hearts <= 0) finish(false);
}

/** 벨트 끝에서 떨어짐 */
export function miss(ent) {
  const S = G.S;
  resolve(S, ent);
  removeEntity(ent, 'fall');
  if (ent.kind === 'combo') { comboMiss(S, ent); return; }
  if (ent.kind !== 'item') return;
  const item = ent.item;
  const bin = binById(item.bin);
  const lost = takeHit(S);
  S.missed += 1;
  onBreak(S);
  requeue(S, item);
  S.mistakes.push({ kind: 'item', item });
  sfx('miss');
  emit('miss', { item });
  if (lost) popHearts();
  toast([`놓쳤어요! ${item.emoji || ''} ${item.name}`, `→ ${bin.emoji} ${bin.full}`], 2200);
  renderHud(S);
  if (S.hearts <= 0) {
    pause('end');
    wait(650).then(() => { if (G.S === S) finish(false); });
  }
}

/** 카드 톡 — 손질 행동 */
export function doAct(ent) {
  const S = G.S;
  if (ent && ent.kind === 'combo') return doSplit(ent);
  if (!S || !canInput() || !ent || ent.gone || ent.kind !== 'item') return false;
  const act = actOf(ent.item);
  if (!act || ent.actDone) { flash(ent.node, 'is-tap'); return false; }
  markActDone(ent, act);
  S.score += ACT_BONUS;
  sfx('act');
  emit('act', { item: ent.item });
  const c = centerOf(ent.node);
  floatText(c.x, c.top, `${act.icon} +${ACT_BONUS}`, 'is-small');
  popScore();
  renderHud(S);
  return true;
}

export function collectPower(ent) {
  const S = G.S;
  if (!S || !canInput() || ent.gone) return;
  resolve(S, ent);
  const text = applyPower(S, ent.power);
  sfx('power');
  emit('power', { power: ent.power });
  const c = centerOf(ent.node);
  burst(c.x, c.y, 'var(--sun)', 16);
  floatText(c.x, c.top, ent.power.emoji, 'is-power');
  removeEntity(ent, 'poof');
  toast(text, 1600);
  renderHud(S);
}

export async function runBonus(q) {
  const S = G.S;
  pause('bonus');
  hideToast();
  sfx('power');
  const res = await openBonus(q);
  if (G.S !== S) return;
  emit('bonus', { q, ok: res === true, timeout: res === null });
  if (res === true) {
    S.score += BONUS_OX;
    if (S.timeMax) S.timeLeft += 5;
    sfx('correct', 1.3);
    popScore();
    toast([`정답! +${BONUS_OX}${S.timeMax ? ' · ⏱️ +5초' : ''}`, q.why], 2000);
    renderHud(S);
    unpause('bonus');
    return;
  }
  sfx('wrong');
  S.mistakes.push({ kind: 'quiz', q });
  pause('sheet');
  unpause('bonus');
  await explainQuiz(q, res === null);
  if (G.S === S) unpause('sheet');
}
