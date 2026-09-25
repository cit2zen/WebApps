// input.js — #board Pointer Events → dispatch({type:'down'|'move'|'up'}) (§6 입력 처리, 규칙 9·12)
// board·dispatch·cellAt(x, y, mode)는 main.js가 주입 — game·render import 없음.
// 좌표계: board 로컬 CSS px(clientX − rect.left). cellAt(..., 'full'|'inner') → idx | null.

const FALLBACK_STEP = 12;   // cellSize 미주입 시 보간 간격(px) — 최소 칸 51px의 절반보다 촘촘

let B = null, D = null, CELL_AT = null, CELL_SIZE = null;
let activeId = null;        // 활성 포인터 1개
let prev = null;            // 직전 좌표(board 로컬)
let lastCell = null;        // 직전에 포인터가 있던 칸(연속 중복 제거 기준)
let rect = null;            // 이벤트당 1회 갱신하는 board rect

function pt(e) { return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }

// 선분 a→b를 칸/2 간격으로 등분, 각 점(a 제외·b 포함)을 내부 70%로 판정해 out에 추가
function interpolate(a, b, out) {
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  const cs = CELL_SIZE ? CELL_SIZE() : 0;
  const stepPx = cs > 0 ? cs / 2 : FALLBACK_STEP;
  const n = Math.max(1, Math.ceil(dist / stepPx));
  for (let k = 1; k <= n; k++) {
    const c = CELL_AT(a.x + dx * k / n, a.y + dy * k / n, 'inner');
    if (c === null || c === undefined || c === lastCell) continue;   // 30% 띠·격자 밖 = 판정 없음(히스테리시스)
    out.push(c); lastCell = c;
  }
}

function onDown(e) {
  if (!e.isPrimary || e.button !== 0 || activeId !== null) return;
  rect = B.getBoundingClientRect();
  const p = pt(e), c = CELL_AT(p.x, p.y, 'full');                  // 칸 전체 = 첫 터치·재개·잘라내기(규칙 9)
  if (c === null || c === undefined) return;                        // 격자 밖 = dispatch·캡처 없음
  e.preventDefault();
  activeId = e.pointerId;
  try { B.setPointerCapture(activeId); } catch { /* 합성 이벤트 등 캡처 불가 — 무시 */ }
  prev = p; lastCell = c;
  D({ type: 'down', cell: c });
}

function onMove(e) {
  if (e.pointerId !== activeId) return;
  rect = B.getBoundingClientRect();
  const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
  const cells = [];
  if (evs && evs.length) for (const ce of evs) { const p = pt(ce); interpolate(prev, p, cells); prev = p; }
  else { const p = pt(e); interpolate(prev, p, cells); prev = p; }
  if (cells.length) D({ type: 'move', cells });                      // 규칙 12: 목록 전체 검증은 game(→moves)
}

function onEnd(e) {
  if (e.pointerId !== activeId) return;
  release();
}

function release() {
  const id = activeId;
  activeId = null; prev = null; lastCell = null;
  try { if (B.hasPointerCapture && B.hasPointerCapture(id)) B.releasePointerCapture(id); } catch { /* noop */ }
  D({ type: 'up' });                                                 // 경로 유지·묶음 미절단(§2)
}

// visibilitychange hidden 등 — 활성 포인터를 pointercancel과 동일 처리(§2 타이머 1)
export function cancel() { if (activeId !== null) release(); }

export function isActive() { return activeId !== null; }

export function init({ board, dispatch, cellAt, cellSize }) {
  B = board; D = dispatch; CELL_AT = cellAt; CELL_SIZE = typeof cellSize === 'function' ? cellSize : null;
  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) board.addEventListener(t, onEnd);
  board.addEventListener('contextmenu', e => e.preventDefault());
}
