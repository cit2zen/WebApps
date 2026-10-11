// 점수 — 콤보 배율, 피버 게이지, 러시·오늘의 규칙 배율, 정확도·별
export const FEVER_NEED = 8;  // 연속 정답 수로 게이지 가득
export const FEVER_TIME = 6;  // 초
export const ACT_BONUS = 50;
export const BONUS_OX = 300;
export const SPLIT_BONUS = 100;
export const RUSH_MULT = 1.5;

export const multOf = (combo) => (combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1.5 : 1);

/** 분류 점수에만 곱하는 배율 — 러시 ×1.5 · 오늘의 규칙(번개 ×1.2, 하트 하나 ×1.5) */
export const sortMult = (S) => (S.scoreMult || 1) * (S.rush ? RUSH_MULT : 1);

/** 정답 처리 → { pts, feverStart } */
export function onCorrect(S) {
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.correct += 1;
  const pts = Math.round(100 * multOf(S.combo) * (S.feverLeft > 0 ? 2 : 1) * sortMult(S));
  S.score += pts;
  let feverStart = false;
  if (S.feverLeft <= 0) {
    S.gauge += 1;
    if (S.gauge >= FEVER_NEED) { S.gauge = 0; S.feverLeft = FEVER_TIME; feverStart = true; }
  }
  return { pts, feverStart };
}

/** 오답·놓침 — 콤보와 게이지가 비워짐 */
export function onBreak(S) {
  S.combo = 0;
  S.gauge = 0;
}

export function accuracy(S) {
  const n = S.correct + S.wrong + S.missed;
  return n ? S.correct / n : 0;
}

/** 성공: ★ · 정확도 80% ★★ · 95% + 놓침 0 ★★★ */
export function starsFor(S, success) {
  if (!success) return 0;
  const a = accuracy(S);
  if (a >= 0.95 && S.missed === 0) return 3;
  if (a >= 0.8) return 2;
  return 1;
}

export const isComboMilestone = (c) => c === 3 || c === 5 || (c >= 10 && c % 5 === 0);
