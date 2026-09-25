// moves.js — 입력형 액션의 격자 처리(§2 규칙 1·2·3·4·5·12, §3 u 묶음 규칙)
// 결과 { ok, events[] } 반환 — emit은 game.js. events[i] = { type, ...payload }
// st = createMoveState(): rewindSegments·resets·last(마지막 경로 변경 종류)·deadEnds·dragOk

export function createMoveState() {
  return { rewindSegments: 0, resets: 0, last: null, deadEnds: 0, dragOk: false };
}

// §3 5음계 idx = floor(9·(len−1)/(n−1))
export function toneIdx(len, n) { return n > 1 ? Math.floor(9 * (len - 1) / (n - 1)) : 0; }

const R = (ok, events) => ({ ok, events });

function doPush(g, st, c, ev) {
  if (!g.push(c)) return false;
  st.last = 'push';
  ev.push({ type: 'push', cell: c, len: g.len, idx: toneIdx(g.len, g.n) });
  return true;
}

function doPop(g, st, ev) {
  const len = g.len;
  const c = g.pop();
  if (c < 0) return false;
  if (st.last !== 'pop') st.rewindSegments += 1;       // 묶음 시작만 +1
  st.last = 'pop';
  ev.push({ type: 'pop', cell: c, idx: toneIdx(len, g.n) });
  return true;
}

// 막다른 길 판정(push 뒤 1회)
function after(g, st, ev) {
  if (g.isDeadEnd()) { st.deadEnds += 1; ev.push({ type: 'deadend', remain: g.remain() }); }
  return ev;
}

// 리셋(롱프레스·R·S까지 cut-back 공통): resets += 1(u += 2), rewindSegments 불변
export function reset(g, st) {
  if (g.len <= 1) return R(true, []);                   // 이미 S뿐 — 무변경·무가산
  g.reset(); st.resets += 1; st.last = 'reset';
  return R(true, [{ type: 'reset' }]);
}

// 규칙 4: 경로 중간 칸까지 잘라내기(u+1), S(index 0)면 리셋
export function cut(g, st, cell) {
  const p = g.indexOf(cell);
  if (p < 0 || p >= g.len - 1) return R(false, []);
  if (p === 0) return reset(g, st);
  const from = g.head, count = g.cutTo(cell);
  st.rewindSegments += 1; st.last = 'cut';
  return R(true, [{ type: 'cut', from, to: cell, count }]);
}

export function push(g, st, cell) {
  const ev = [];
  if (!doPush(g, st, cell, ev)) return R(false, [{ type: 'invalid', cell }]);
  return R(true, after(g, st, ev));
}

export function pop(g, st) {
  const ev = [];
  return R(doPop(g, st, ev), ev);
}

// 규칙 5·4·9: pointerdown(칸 전체 판정)
export function down(g, st, cell) {
  st.dragOk = false;
  if (!g.inBounds(cell)) return R(false, []);
  if (g.len === 1) {
    if (cell === g.start) { st.dragOk = true; return R(true, []); }
    return R(false, [{ type: 'invalid', cell, kind: 'start' }]);  // S 맥동 + 흔들림
  }
  if (cell === g.head) { st.dragOk = true; return R(true, []); }
  if (g.indexOf(cell) >= 0) { const r = cut(g, st, cell); st.dragOk = r.ok; return r; }
  if (g.canPush(cell)) { const r = push(g, st, cell); st.dragOk = true; return r; }
  return R(false, [{ type: 'invalid', cell, kind: 'head' }]);       // 헤일로 맥동 + 흔들림
}

// 규칙 12: 보간 칸 목록 전체 검증 — 하나라도 무효면 전체 무시(롤백)
export function move(g, st, cells) {
  if (!st.dragOk || !Array.isArray(cells) || cells.length === 0) return R(false, []);
  const snap = { rs: st.rewindSegments, last: st.last };
  const ops = [], ev = [];
  let ok = true, pushed = false;
  for (const c of cells) {
    if (g.len === g.n) break;                           // 클리어 도달 — 나머지 무시
    if (c === g.head) continue;
    if (g.len >= 2 && c === g.path[g.len - 2]) { const h = g.head; doPop(g, st, ev); ops.push(-1 - h); continue; }
    if (doPush(g, st, c, ev)) { ops.push(c); pushed = true; continue; }
    ok = false; break;
  }
  if (!ok) {
    for (let i = ops.length - 1; i >= 0; i--) { if (ops[i] >= 0) g.pop(); else g.pushRaw(-1 - ops[i]); }
    st.rewindSegments = snap.rs; st.last = snap.last;
    return R(false, []);
  }
  if (!ops.length) return R(true, []);
  return R(true, pushed && ops[ops.length - 1] >= 0 ? after(g, st, ev) : ev);
}

// pointerup·cancel: 경로 유지·묶음 미절단(§2)
export function up(g, st) { st.dragOk = false; return R(true, []); }

// 방향키: head+dir → path[len−2]면 pop, 인접·열린·미방문이면 push, 아니면 invalid
export function keyDir(g, st, dir) {
  const t = g.step(g.head, dir);
  if (t >= 0 && g.len >= 2 && t === g.path[g.len - 2]) return pop(g, st);
  if (t >= 0 && g.canPush(t)) return push(g, st, t);
  return R(false, [{ type: 'invalid', cell: t >= 0 ? t : g.head, kind: 'head' }]);
}
