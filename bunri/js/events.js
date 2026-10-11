// 게임 이벤트 버스 — 판정 코드를 건드리지 않고 마스코트·음악·스티커가 반응
// 이벤트 (detail):
//   screen {name}                 화면 전환 (lobby·stages·play·result·dex·stickers)
//   run:start {mode, stage}       판 시작 — mode: stage·endless·daily·review
//   run:end {...결과, mode}        판 끝 — 결과 화면에 넘기는 것과 같은 객체 (onEnd보다 먼저)
//   run:exit {mode, stage}        일시정지 메뉴에서 '처음으로'
//   pause {why} · unpause {why}   일시정지 이유가 생김/풀림 (count·coach·bonus·sheet·menu·end)
//   correct {item, pts, combo, fever} · wrong {item, binId, skippedAct} · miss {item}
//   act {item} · combo {combo} (마일스톤) · fever {on}
//   bonus {q, ok, timeout} · power {power}
//   danger {on}                   맨 앞 카드가 벨트 끝에 가까움 (바뀔 때만)
//   rush {on} · split {combo} · shield {}
const subs = new Map();

/** 구독 — 해제 함수를 돌려줌 */
export function on(type, fn) {
  if (!subs.has(type)) subs.set(type, new Set());
  subs.get(type).add(fn);
  return () => subs.get(type)?.delete(fn);
}

export function emit(type, detail = {}) {
  const set = subs.get(type);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(detail); } catch (e) { console.error(`[bunri] '${type}' 처리 중 오류`, e); }
  }
}
