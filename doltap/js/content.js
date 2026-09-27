// js/content.js — 소원·산길 JSON 로더(§5 데이터 파일 구성). fetch 3000ms 타임아웃, 스키마 검증, 폴백, console.warn 1회
export const WISH_FALLBACK = '오늘도 무사히 내려가기를';
export const TRAIL_FALLBACK = '이름 없는 산길';
export const TIMEOUT_MS = 3000;
const WISH_RE = /^[가-힣 ,]{4,20}$/;
const TRAIL_RE = /^[가-힣 ]{5,12}$/;

let warned = false;
function warnOnce(msg) {
  if (warned) return;
  warned = true;
  console.warn(`[doltap] ${msg} — 내장 폴백을 씁니다`);
}

async function getItems(url, count, fetchFn, timeoutMs) {
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j || !Array.isArray(j.items) || j.items.length !== count) throw new Error('스키마(items 개수)');
    return j.items;
  } catch (e) {
    warnOnce(`${url} 로드 실패: ${e && e.message}`);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// boot에서 main이 호출(Promise.all). fetchFn은 테스트·contentFallback 스텁 주입용
export async function load(fetchFn = (u, o) => fetch(u, o), timeoutMs = TIMEOUT_MS) {
  const [wishes, trails] = await Promise.all([
    getItems('./data/wishes.json', 60, fetchFn, timeoutMs),
    getItems('./data/trails.json', 30, fetchFn, timeoutMs),
  ]);
  return { wishes, trails };
}

// DailySet의 wishIdx·trailIdx로 문구를 고른다. 해당 항목이 규칙에 어긋나면 인덱스와 관계없이 폴백 1개
export function pick(content, set) {
  const w = content.wishes && content.wishes[set.wishIdx];
  const t = content.trails && content.trails[set.trailIdx];
  const wishOk = !!w && typeof w.text === 'string' && WISH_RE.test(w.text);
  const trailOk = !!t && typeof t.name === 'string' && TRAIL_RE.test(t.name);
  if (content.wishes && !wishOk) warnOnce(`wishes[${set.wishIdx}] 스키마 불일치`);
  if (content.trails && !trailOk) warnOnce(`trails[${set.trailIdx}] 스키마 불일치`);
  return {
    wish: wishOk ? w.text : WISH_FALLBACK,
    trail: trailOk ? t.name : TRAIL_FALLBACK,
    fallback: !wishOk || !trailOk,
  };
}
