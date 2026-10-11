// 오늘의 도전 — 날짜 시드(같은 날 = 같은 카드 순서) + 오늘의 규칙
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 문자열 → 32비트 시드 (FNV-1a) */
export function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 시드 난수 (mulberry32) — Math.random 대신 넘겨 씀 */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 오늘의 규칙 — 효과는 엔진이 id로 적용 */
export const MODS = [
  { id: 'fast', icon: '⚡', name: '번개 벨트', desc: '벨트가 더 빨라요 · 점수 ×1.2' },
  { id: 'prep', icon: '🏷️', name: '손질 대잔치', desc: '손질할 카드가 자주 나와요' },
  { id: 'onelife', icon: '💗', name: '하트 하나', desc: '하트가 1개뿐 · 점수 ×1.5' },
  { id: 'golden', icon: '✨', name: '황금 비', desc: '황금 아이템이 자주 나와요' },
  { id: 'split', icon: '📦', name: '분해 러시', desc: '분해 카드가 자주 나와요' },
  { id: 'quiz', icon: '⭐', name: '퀴즈 쇼', desc: '보너스 OX가 더 자주 나와요' },
];

/** 오늘(또는 key 날짜)의 도전 — { key, seed, mod } */
export function dailySpec(key = todayKey()) {
  const seed = seedOf('bunri:' + key);
  return { key, seed, mod: MODS[seed % MODS.length] };
}

/** 'YYYY-MM-DD' 두 날짜 사이 일 수 (b − a) */
export function dayDiff(a, b) {
  const t = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}
