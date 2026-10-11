// localStorage 'bunri.v1' — 모든 읽기/쓰기는 try/catch, 저장소가 없어도 게임은 동작
const KEY = 'bunri.v1';
const defaults = () => ({ stars: { 1: 0, 2: 0, 3: 0 }, best: {}, seen: [], sound: true, coached: false, x: {} });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) || {};
    return {
      stars: { ...base.stars, ...(d.stars && typeof d.stars === 'object' ? d.stars : {}) },
      best: d.best && typeof d.best === 'object' ? d.best : {},
      seen: Array.isArray(d.seen) ? d.seen.filter((x) => typeof x === 'string') : [],
      sound: d.sound !== false,
      coached: d.coached === true,
      x: isObj(d.x) ? d.x : {},
    };
  } catch {
    return base;
  }
}

const state = load();
/** 4단계 = 무한 도전 → best.endless */
const bestKey = (stage) => (stage === 4 ? 'endless' : String(stage));
const seenSet = new Set(state.seen);

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 불가 — 무시 */ }
}

export const store = {
  stars: (stage) => Number(state.stars[stage]) || 0,
  best: (stage) => Number(state.best[bestKey(stage)]) || 0,
  coached: () => state.coached,
  sound: () => state.sound,
  isSeen: (id) => seenSet.has(id),
  seenCount: (ids) => ids.filter((id) => seenSet.has(id)).length,
  isUnlocked: (stage) => stage <= 1 || (Number(state.stars[stage - 1]) || 0) > 0,
  /** 추가 기록(x) — 음악·스티커·통계·복습·오늘의 도전 등 JSON 값 */
  get: (key, fallback) => (key in state.x ? state.x[key] : fallback),
  set(key, value) {
    state.x[key] = value;
    save();
  },

  markSeen(id) {
    if (seenSet.has(id)) return;
    seenSet.add(id);
    state.seen.push(id);
    save();
  },
  setCoached() {
    state.coached = true;
    save();
  },
  setSound(on) {
    state.sound = !!on;
    save();
  },
  /** 결과 저장 → 최고 기록 갱신 여부 */
  record(stage, score, stars) {
    const k = bestKey(stage);
    const isBest = score > 0 && score > (Number(state.best[k]) || 0);
    if (isBest) state.best[k] = score;
    if (stage < 4 && stars > (Number(state.stars[stage]) || 0)) state.stars[stage] = stars;
    save();
    return isBest;
  },
};
