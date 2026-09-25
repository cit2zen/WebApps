// score.js — §3 점수·보상 공식 그대로(u·stars·streak·bestStreak·maxClearedLevel·packScore)

export function initialProgress() {
  return { v: 1, maxClearedLevel: 0, stars: [0], streak: 0, bestStreak: 0 };
}

// 진행 객체 검증(§6 저장 표) — 실패 시 초기값
export function normalizeProgress(p) {
  const ok = p && typeof p === 'object' && p.v === 1
    && Number.isInteger(p.maxClearedLevel) && p.maxClearedLevel >= 0
    && Array.isArray(p.stars) && p.stars.length >= 1
    && p.stars.every(x => Number.isInteger(x) && x >= 0 && x <= 3)
    && Number.isInteger(p.streak) && p.streak >= 0
    && Number.isInteger(p.bestStreak) && p.bestStreak >= 0;
  if (!ok) return initialProgress();
  return { v: 1, maxClearedLevel: p.maxClearedLevel, stars: p.stars.slice(), streak: p.streak, bestStreak: p.bestStreak };
}

// u = rewindSegments + 2 × resets
export function computeU(rewindSegments, resets) { return rewindSegments + 2 * resets; }

// stars = hintUsed ? 1 : (u == 0 ? 3 : (u <= 3 ? 2 : 1))
export function starsFor(u, hintUsed) { return hintUsed ? 1 : (u === 0 ? 3 : (u <= 3 ? 2 : 1)); }

// 클리어 반영 → 새 진행 객체(입력 불변). streak는 첫 도전(L == maxClearedLevel + 1)에서만 변동
export function applyClear(progress, L, s) {
  const p = normalizeProgress(progress);
  if (L === p.maxClearedLevel + 1) p.streak = s === 3 ? p.streak + 1 : 0;
  p.bestStreak = Math.max(p.bestStreak, p.streak);
  const stars = p.stars;
  while (stars.length <= L) stars.push(0);
  stars[L] = Math.max(stars[L], s);
  p.maxClearedLevel = Math.max(p.maxClearedLevel, L);
  return p;
}

// packScore[k] = Σ stars[10k−9 … 10k] (최대 30)
export function packScore(stars, k) {
  let sum = 0;
  for (let L = 10 * k - 9; L <= 10 * k; L++) sum += (stars && stars[L]) || 0;
  return sum;
}

// hanbut:log 엔트리 {L, t(ms), u, stars}
export function logEntry(L, t, u, stars) { return { L, t: Math.round(t), u, stars }; }

export function packOf(L) { return Math.ceil(L / 10); }
// 팩 10레벨째 → 팩 완료 카드
export function isPackEnd(L) { return L % 10 === 0; }
// 팩 5+ 3·6·9레벨째 → 정지 카드('이어하기/로비' 상시, 자동 진행 없음)
export function isPauseCard(L) { const r = L % 10; return packOf(L) >= 5 && (r === 3 || r === 6 || r === 9); }
