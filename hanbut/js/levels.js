// levels.js — levels.json fetch · 로더 검증 규칙 0~9(§5 표, tools/validate.py와 동일) · 패리티 · wallSet 빌드
// validateLevels(json, kind) = 규칙 0·1 + 레벨별 validateLevel(lv, i, kind) = 규칙 2~9.
// DOM 접근 없음 — 표시(STR.loadError / STR.dataError)는 main.js가 반환값으로 처리.

export const FORMAT = 'hanbut-levels/1';

let lastJson = null;       // 마지막 loadLevels 원본(테스트 훅 validateLevels() 인자 생략 시 사용)
let lastKind = 'levels';

const isInt = x => Number.isInteger(x);
const isIntArr = a => Array.isArray(a) && a.every(isInt);

/** 벽 키 — grid.js와 같은 규칙(작은 idx·64 + 큰 idx, 7×7 = 49칸 < 64). */
export function wallKey(a, b) { return a < b ? a * 64 + b : b * 64 + a; }

/** walls [[a,b],…] → Set<wallKey>. */
export function buildWallSet(walls) {
  const s = new Set();
  if (Array.isArray(walls)) for (const p of walls) s.add(wallKey(p[0], p[1]));
  return s;
}

/** 체스판 색(0/1) — r·w + c 인덱스 기준 (r + c) % 2. */
export function colorOf(idx, w) { return (Math.floor(idx / w) + (idx % w)) % 2; }

/** 패리티(규칙 9): 열린 칸 두 색 개수 차 ≤ 1, 차 1이면 start(·end)가 다수색. cells = 열린 칸 목록. */
export function parityOk(cells, w, start, end = null) {
  const cnt = [0, 0];
  for (const c of cells) cnt[colorOf(c, w)]++;
  const d = cnt[0] - cnt[1];
  if (Math.abs(d) > 1) return false;
  if (d === 0) return true;
  const major = d > 0 ? 0 : 1;
  if (colorOf(start, w) !== major) return false;
  return end === null || end === undefined || colorOf(end, w) === major;
}

/** 레벨 id — levels: 'L{n}'(n = i+1) / daily: 'D{i}'. */
export function levelId(i, kind) { return kind === 'daily' ? `D${i}` : `L${i + 1}`; }

/** 규칙 2~9 → null(통과) | 사유 문자열(§5 표의 사유). */
export function validateLevel(lv, i, kind) {
  if (!lv || typeof lv !== 'object') return 'holes';
  const { w, h, holes, start } = lv;
  // 2: 3 ≤ w,h ≤ 7, holes 오름차순·범위 내·start 미포함
  if (!isInt(w) || !isInt(h) || w < 3 || w > 7 || h < 3 || h > 7 || !isIntArr(holes) || !isInt(start)) return 'holes';
  const size = w * h;
  if (start < 0 || start >= size || holes.includes(start)) return 'holes';
  for (let j = 0; j < holes.length; j++) {
    if (holes[j] < 0 || holes[j] >= size) return 'holes';
    if (j > 0 && holes[j - 1] >= holes[j]) return 'holes';
  }
  const hs = new Set(holes);
  const { sol, walls, end, waypoints: wps } = lv;
  // 3: 길이·시작
  if (!isIntArr(sol) || sol.length !== size - holes.length) return 'len';
  if (sol[0] !== start) return 'start';
  // 4: 중복·구멍
  if (new Set(sol).size !== sol.length) return 'dup';
  for (const c of sol) if (hs.has(c) || c < 0 || c >= size) return 'hole';
  // 5: 연속 쌍 인접 · 벽 미통과
  if (!Array.isArray(walls) || !walls.every(p => isIntArr(p) && p.length === 2)) return 'walls';
  const adj = (a, b) => Math.abs(Math.floor(a / w) - Math.floor(b / w)) + Math.abs((a % w) - (b % w)) === 1;
  const wset = buildWallSet(walls);
  const used = new Set();
  for (let j = 1; j < sol.length; j++) {
    const a = sol[j - 1], b = sol[j];
    if (!adj(a, b)) return `adj ${a}-${b}`;
    if (wset.has(wallKey(a, b))) return `wall ${a}-${b}`;
    used.add(wallKey(a, b));
  }
  // 6: walls 각 쌍 = [a,b](a<b) 인접 열린 칸 · sol 미사용 변 · 중복 없음
  if (wset.size !== walls.length) return 'walls';
  for (const [a, b] of walls) {
    if (!(a >= 0 && a < b && b < size) || hs.has(a) || hs.has(b) || !adj(a, b) || used.has(wallKey(a, b))) return 'walls';
  }
  // 7: end == null 또는 sol[n−1]
  if (end !== null && end !== undefined && (!isInt(end) || end !== sol[sol.length - 1])) return 'end';
  // 8: waypoints 중복·start/end 제외·열린 칸·sol 상 순서 오름차순(재계산 없음)
  if (!isIntArr(wps) || new Set(wps).size !== wps.length) return 'wp';
  const pos = new Map();
  sol.forEach((c, j) => pos.set(c, j));
  for (let j = 0; j < wps.length; j++) {
    const c = wps[j];
    if (c === start || c === end || !pos.has(c)) return 'wp';
    if (j > 0 && pos.get(wps[j - 1]) >= pos.get(c)) return 'wp';
  }
  // 9: 패리티
  if (!parityOk(sol, w, start, end ?? null)) return 'parity';
  return null;
}

/** 파일 전체 검사(규칙 0·1 + 레벨별 2~9) → { ok, errors:string[], id }.
 *  규칙 0 실패 = errors ['format'], id null. 레벨 오류 = 'L3 len' 형식, id = 첫 실패 레벨 id.
 *  인자 생략 시 마지막 loadLevels 원본으로 검사(테스트 훅 __hanbut.validateLevels()용). */
export function validateLevels(json = lastJson, kind = lastKind) {
  if (!json || typeof json !== 'object' || json.format !== FORMAT || json.kind !== kind || !Array.isArray(json.levels)) {
    return { ok: false, errors: ['format'], id: null };
  }
  const errors = [];
  let id = null;
  json.levels.forEach((lv, i) => {
    const d = lv && typeof lv === 'object' ? lv : {};
    const ok1 = kind === 'daily'
      ? d.i === i && d.pack === null
      : d.L === i + 1 && d.pack === Math.ceil((i + 1) / 10);
    const why = ok1 ? validateLevel(lv, i, kind) : 'order';
    if (why) {
      const lid = levelId(i, kind);
      if (id === null) id = lid;
      errors.push(`${lid} ${why}`);
    }
  });
  return { ok: errors.length === 0, errors, id };
}

/** fetch + 파싱 + 검증 → { ok, levels, json, error, id, errors }.
 *  error: null | 'loadError'(fetch 실패·JSON 파싱 실패·규칙 0) | 'dataError'(규칙 1~9, id = 'L{n}'/'D{i}').
 *  throw 하지 않는다. 실패 시 levels = null(진입 차단). */
export async function loadLevels(url = './levels.json', kind = 'levels') {
  let json;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    console.error(`[hanbut] levels load failed: ${err && err.message}`);
    return { ok: false, levels: null, json: null, error: 'loadError', id: null, errors: ['load'] };
  }
  lastJson = json;
  lastKind = kind;
  const v = validateLevels(json, kind);
  if (!v.ok) {
    if (v.errors[0] === 'format') {
      console.error('[hanbut] levels format invalid');
      return { ok: false, levels: null, json, error: 'loadError', id: null, errors: v.errors };
    }
    for (const e of v.errors) {
      const sp = e.indexOf(' ');
      console.error(`[hanbut] level ${e.slice(0, sp)} invalid: ${e.slice(sp + 1)}`);
    }
    return { ok: false, levels: null, json, error: 'dataError', id: v.id, errors: v.errors };
  }
  return { ok: true, levels: json.levels, json, error: null, id: null, errors: [] };
}
