// hanbut UI 문자열 — DOM 텍스트 삽입의 단일 경로(§5 문자열 표 · §6 보안 규칙).
// HTML 문자열 삽입 API 사용 0건. 텍스트는 setText(STR 키) · setRaw(숫자·★☆ 글리프)로만 넣는다.

export const STR = Object.freeze({
  remainLabel: '남음',
  streak: '{n}연속',
  hint: '힌트',
  reset: '다시',
  resetTip: '길게 누르세요',
  next: '탭하여 다음',
  cont: '이어하기',
  lobby: '로비',
  pack: '팩 {k}',
  packScore: '{s}/30',
  packDone: '팩 {k} 완료',
  level: 'L{n}',
  paused: '일시정지',
  resume: '계속',
  tapToContinue: '탭하여 계속',
  bestStreak: '최고 연속 {n}',
  hintBack: '여기부터 다시',
  dataError: '레벨 데이터 오류 ({id})',
  loadError: '레벨 데이터를 불러오지 못했어요',
  lvlLabel: '팩 {k} · L{n}',
  start: '시작하기',
  contAt: '이어하기 · L{n}',
  again: '다시 · L1',
  polNumPack: '№ {nn} — pack',
  polNumLevel: '№ {nn} — {w}×{h}',
  rewinds: '되감기 {u}',
  hintUsed: '힌트 사용',
  packLocked: '—/30',
  packDoneCaption: '팩 {k} · {s}/30',
  wipeConfirm: '한 번 더 누르면 초기화',
  daily: '오늘의 한붓',
});

// 포스트MVP 팩 캡션(§5·§9 h) — 기본 빈 배열, index = pack − 1. 로비는 문자열일 때만 그린다.
export const PACK_CAPTIONS = [];

/**
 * STR[key]의 {name} 자리표시자를 obj 값으로 치환한다.
 * 없는 키는 console.error 후 빈 문자열, obj에 없는 자리표시자는 원문 유지.
 */
export function fmt(key, obj) {
  const tpl = Object.prototype.hasOwnProperty.call(STR, key) ? STR[key] : null;
  if (tpl === null) {
    console.error(`[hanbut] unknown string key: ${key}`);
    return '';
  }
  if (!obj) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(obj, name) ? String(obj[name]) : m);
}

/** 두 자리 0 채움(№ 01 표기용) — 호출 측 편의 헬퍼. */
export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** STR 키 전용 텍스트 삽입: el.textContent = fmt(key, obj). */
export function setText(el, key, obj) {
  if (!el) return;
  el.textContent = fmt(key, obj);
}

/** 숫자·★☆ 글리프 전용 텍스트 삽입: el.textContent = String(text). */
export function setRaw(el, text) {
  if (!el) return;
  el.textContent = String(text);
}
