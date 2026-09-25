// solver.js — 힌트 DFS(§2 규칙 8, §5 절차 ④와 동일 가지치기)
// Warnsdorff 순(진행 차수 오름차순, 동점 = 칸 idx 오름차순) + 미방문 연결성 + 차수 가지치기
// deadline 40ms · maxNodes 200,000. DOM 없음, grid는 읽기만(내부 사본에서 탐색).

const now = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

// §5 ④ 가지치기: true = 되돌아감. vis = 방문 배열, remaining = 미방문 열린 칸 수
export function prune(g, vis, head, remaining, queue) {
  if (remaining === 0) return false;
  const size = g.size, open = g.open, nb = g.nb, E = g.end;
  // 차수: deg(v) = |미방문 이웃(v)| + (v가 head와 인접이면 1)
  let low = 0, first = -1;
  for (let v = 0; v < size; v++) {
    if (!open[v] || vis[v]) continue;
    if (first < 0) first = v;
    let d = 0;
    for (const j of nb[v]) if (!vis[j] || j === head) d++;
    const lone = remaining === 1 && nb[v].includes(head);
    if (E < 0) {
      if (d === 0 && !lone) return true;
      if (d <= 1 && ++low >= 2) return true;
    } else if (v === E) {
      if (d === 0 && !lone) return true;
    } else if (d <= 1) return true;
  }
  // 미방문 영역 연결성(BFS) + head가 영역에 닿는지
  const q = queue || new Int16Array(size), seen = new Uint8Array(size);
  let qh = 0, qt = 0, cnt = 0;
  q[qt++] = first; seen[first] = 1;
  while (qh < qt) {
    const v = q[qh++]; cnt++;
    for (const j of nb[v]) if (!vis[j] && !seen[j]) { seen[j] = 1; q[qt++] = j; }
  }
  if (cnt !== remaining) return true;
  for (const j of nb[head]) if (!vis[j]) return false;
  return true;
}

// 현재 경로에서 남은 칸 해 탐색 → { status:'found'|'none'|'budget', rest:int[] }
export function solve(g, { deadline = 40, maxNodes = 200000 } = {}) {
  const vis = Uint8Array.from(g.visited), wpo = g.wpOrder, E = g.end;
  const q = new Int16Array(g.size), rest = [];
  const t0 = now();
  let nodes = 0, budget = false, wpNext = g.wpNext, remaining = g.remain();
  const ok = c => {
    if (vis[c]) return false;
    const o = wpo[c];
    if (o >= 0 && o !== wpNext) return false;
    return !(c === E && remaining !== 1);
  };
  if (remaining === 0) return { status: 'found', rest };
  if (prune(g, vis, g.head, remaining, q)) return { status: 'none', rest };
  function dfs(head) {
    if (remaining === 0) return true;
    if (++nodes > maxNodes || ((nodes & 255) === 0 && now() - t0 > deadline)) { budget = true; return false; }
    const cand = [];
    for (const c of g.nb[head]) if (ok(c)) cand.push(c);
    const key = c => { let d = 0; for (const j of g.nb[c]) if (!vis[j]) d++; return d * 64 + c; };
    cand.sort((a, b) => key(a) - key(b));
    for (const c of cand) {
      vis[c] = 1; remaining--; rest.push(c);
      const o = wpo[c], prevWp = wpNext;
      if (o >= 0) wpNext = o + 1;
      if (!prune(g, vis, c, remaining, q) && dfs(c)) return true;
      vis[c] = 0; remaining++; rest.pop(); wpNext = prevWp;
      if (budget) return false;
    }
    return false;
  }
  if (dfs(g.head)) return { status: 'found', rest };
  return { status: budget ? 'budget' : 'none', rest: [] };
}

// 현재 경로와 sol의 최장 공통 접두사 끝 칸
export function prefixEnd(path, sol) {
  let k = 0;
  while (k < path.length && k < sol.length && path[k] === sol[k]) k++;
  return k > 0 ? sol[k - 1] : sol[0];
}

// 힌트: 해 있으면 { cells: 다음 3칸 } / 예산 초과·해 없음이면 { backCell }
export function hint(g, sol, opts) {
  const r = solve(g, opts);
  if (r.status === 'found' && r.rest.length) return { cells: r.rest.slice(0, 3) };
  return { backCell: prefixEnd(g.path, sol || g.level.sol) };
}
