// 복습 목록·오늘의 도전 기록 — 순수 함수(저장소·DOM 없음, 입력을 바꾸지 않고 새 값을 돌려줌)
import { dayDiff } from './daily.js';

/** 틀림/놓침 → { id: { n: n+1, ok: 0 } } */
export function reviewMiss(list, id) {
  const prev = list[id];
  return { ...list, [id]: { n: (prev ? Number(prev.n) || 0 : 0) + 1, ok: 0 } };
}

/** 목록에 있는 카드를 맞힘 → ok += (복습 모드 2 / 그 밖 1), ok ≥ 2면 졸업(목록에서 뺌) */
export function reviewHit(list, id, mode) {
  const prev = list[id];
  if (!prev) return { list, graduated: false };
  const ok = (Number(prev.ok) || 0) + (mode === 'review' ? 2 : 1);
  if (ok >= 2) {
    const next = { ...list };
    delete next[id];
    return { list: next, graduated: true };
  }
  return { list: { ...list, [id]: { n: Number(prev.n) || 1, ok } }, graduated: false };
}

/** 가장 많이 틀린 순서로 최대 max개 (valid로 거름) */
export function reviewPick(list, max = 12, valid = null) {
  return Object.keys(list)
    .filter((id) => !valid || valid.has(id))
    .sort((a, b) => (Number(list[b].n) || 0) - (Number(list[a].n) || 0))
    .slice(0, max);
}

/** 오늘의 도전 기록 갱신 — rec = { key, best, streak, last } · 어제 했으면 연속 +1, 오늘 또 하면 그대로, 아니면 1 */
export function dailyNext(rec, key, score) {
  const r = rec && typeof rec.last === 'string' ? rec : null;
  if (r && r.last === key) {
    const prevBest = Number(r.best) || 0;
    return { rec: { key, best: Math.max(prevBest, score), streak: Number(r.streak) || 1, last: key }, isBest: score > prevBest };
  }
  const streak = r && dayDiff(r.last, key) === 1 ? (Number(r.streak) || 0) + 1 : 1;
  return { rec: { key, best: score, streak, last: key }, isBest: score > 0 };
}

/** 로비 표시용 — 오늘 최고 점수, 이어지는 연속 일수(어제까지 했으면 유지) */
export function dailyView(rec, today) {
  const r = rec && typeof rec.last === 'string' ? rec : null;
  if (!r) return { best: 0, streak: 0, playedToday: false };
  const d = dayDiff(r.last, today);
  return {
    best: d === 0 ? Number(r.best) || 0 : 0,
    streak: d === 0 || d === 1 ? Number(r.streak) || 0 : 0,
    playedToday: d === 0,
  };
}
