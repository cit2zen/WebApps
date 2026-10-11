// 스티커 정의 — 순수 로직(DOM·저장소 없음). check(stats, run): run은 판이 끝났을 때만 있음
// stats = { runs, acts, bonusOk, splits, golden, fevers, graduates, maxCombo, dailyTop,
//           endlessBest, streak, stars:{1,2,3}, seen, total }
// run   = { mode, stage, success, stars, score, wrong, missed, fevers, maxCombo } | null
const starsOf = (s) => [1, 2, 3].map((n) => Number(s.stars && s.stars[n]) || 0);

export const STICKERS = [
  { id: 'first', emoji: '🎉', c: 'var(--coral)', name: '첫 완주', desc: '아무 판이나 끝까지 해요.', check: (s) => s.runs >= 1 },
  { id: 'st1', emoji: '🥉', c: 'var(--bin-plastic)', name: '1단계 통과', desc: '1단계를 깨요.', check: (s) => starsOf(s)[0] > 0 },
  { id: 'st2', emoji: '🥈', c: 'var(--bin-styro)', name: '2단계 통과', desc: '2단계를 깨요.', check: (s) => starsOf(s)[1] > 0 },
  { id: 'st3', emoji: '🥇', c: 'var(--sun)', name: '3단계 통과', desc: '3단계를 깨요.', check: (s) => starsOf(s)[2] > 0 },
  { id: 'star3', emoji: '⭐', c: 'var(--sun)', name: '별 세 개', desc: '아무 단계에서나 별 3개를 받아요.', check: (s) => starsOf(s).some((n) => n >= 3) },
  { id: 'star9', emoji: '🌟', c: 'var(--bin-special)', name: '별 부자', desc: '세 단계 모두 별 3개, 별 9개를 모아요.', check: (s) => starsOf(s).every((n) => n >= 3) },
  { id: 'combo10', emoji: '🔥', c: 'var(--bin-can)', name: '콤보 10', desc: '한 판에서 콤보 10을 만들어요.', check: (s) => s.maxCombo >= 10 },
  { id: 'combo25', emoji: '💥', c: 'var(--coral)', name: '콤보 25', desc: '한 판에서 콤보 25를 만들어요.', check: (s) => s.maxCombo >= 25 },
  { id: 'fever1', emoji: '🌈', c: 'var(--bin-pet)', name: '첫 FEVER', desc: 'FEVER를 처음으로 켜요.', check: (s) => s.fevers >= 1 },
  { id: 'fever3', emoji: '🎆', c: 'var(--bin-special)', name: 'FEVER 세 번', desc: '한 판에서 FEVER를 3번 켜요.', check: (s, r) => !!r && r.fevers >= 3 },
  { id: 'acts30', emoji: '🧽', c: 'var(--bin-pet)', name: '손질 달인', desc: '손질(비우기·떼기)을 모두 30번 해요.', check: (s) => s.acts >= 30 },
  { id: 'quiz10', emoji: '💡', c: 'var(--sun)', name: 'OX 척척박사', desc: '보너스 OX 퀴즈를 모두 10개 맞혀요.', check: (s) => s.bonusOk >= 10 },
  { id: 'split10', emoji: '✂️', c: 'var(--bin-carton)', name: '분해 장인', desc: '분해 카드를 모두 10번 나눠요.', check: (s) => s.splits >= 10 },
  { id: 'gold10', emoji: '✨', c: 'var(--sun)', name: '황금 손', desc: '황금 아이템을 모두 10개 넣어요.', check: (s) => s.golden >= 10 },
  { id: 'dex50', emoji: '📖', c: 'var(--bin-paper)', name: '도감 절반', desc: '도감 카드를 절반 넘게 발견해요.', check: (s) => s.total > 0 && s.seen * 2 >= s.total },
  { id: 'dex100', emoji: '📚', c: 'var(--brand)', name: '도감 완성', desc: '도감 카드를 모두 발견해요.', check: (s) => s.total > 0 && s.seen >= s.total },
  { id: 'endless', emoji: '♾️', c: 'var(--bin-special)', name: '무한 질주', desc: '무한 도전에서 2,000점을 넘겨요.', check: (s) => s.endlessBest >= 2000 },
  { id: 'grad10', emoji: '🎓', c: 'var(--ok)', name: '복습 졸업생', desc: '헷갈린 카드를 모두 10장 졸업시켜요.', check: (s) => s.graduates >= 10 },
  { id: 'streak3', emoji: '📅', c: 'var(--bin-glass)', name: '3일 연속', desc: '오늘의 도전을 3일 연속으로 해요.', check: (s) => s.streak >= 3 },
  { id: 'daily1500', emoji: '🏆', c: 'var(--sun)', name: '오늘의 챔피언', desc: '오늘의 도전에서 1,500점을 넘겨요.', check: (s) => s.dailyTop >= 1500 },
  { id: 'flawless', emoji: '💎', c: 'var(--bin-pet)', name: '완벽한 판', desc: '틀리거나 놓친 카드 없이 단계를 깨요.', check: (s, r) => !!r && r.mode === 'stage' && r.success && !r.wrong && !r.missed },
];

export const stickerById = (id) => STICKERS.find((s) => s.id === id) || null;

/** 새로 열린 스티커 id 목록 — owned: { id: 'YYYY-MM-DD' } */
export function newStickers(stats, run, owned = {}) {
  return STICKERS.filter((s) => {
    if (owned[s.id]) return false;
    try { return !!s.check(stats, run || null); } catch { return false; }
  }).map((s) => s.id);
}

const TITLES = [
  [16, '지구 지킴이', '🌏'],
  [12, '분리수거 박사', '🎓'],
  [7, '분리수거 요정', '🧚'],
  [3, '분리수거 꿈나무', '🌿'],
  [0, '분리수거 새싹', '🌱'],
];

/** 붙인 스티커 수 → 칭호 */
export function titleFor(n) {
  const [, name, icon] = TITLES.find(([min]) => n >= min);
  return { name, icon };
}

/** id마다 늘 같은 기울기(−7°~7°) */
export function tiltOf(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 15) - 7;
}
