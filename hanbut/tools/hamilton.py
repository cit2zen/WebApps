"""hamilton.py — Warnsdorff DFS · 연결성/차수 가지치기(head 인접 포함, §5 절차 ④) · P 판정(⑦).
JS 힌트 DFS(solver.js)와 같은 가지치기 규칙을 공유한다."""
import sys
from itertools import groupby

sys.setrecursionlimit(10000)


class Budget(Exception):
    pass


class Board:
    """격자: open 배열 · 인접 리스트(벽 제외, 오름차순) · E · 경유점 순서."""

    def __init__(self, w, h, holes=(), walls=(), end=None, waypoints=()):
        self.w, self.h = w, h
        hs = set(holes)
        ws = {(min(a, b), max(a, b)) for a, b in walls}
        self.open = [i not in hs for i in range(w * h)]
        self.n = sum(self.open)
        self.end = end
        self.wps = list(waypoints)
        self.wp_rank = {c: j for j, c in enumerate(self.wps)}
        self.adj = [[] for _ in range(w * h)]
        for i in range(w * h):
            if not self.open[i]:
                continue
            r, c = divmod(i, w)
            for rr, cc in ((r - 1, c), (r, c - 1), (r, c + 1), (r + 1, c)):
                j = rr * w + cc
                if 0 <= rr < h and 0 <= cc < w and self.open[j] and (min(i, j), max(i, j)) not in ws:
                    self.adj[i].append(j)


def pruned(b, vis, head, remaining):
    """push 직후 검사 — True = 되돌아감. deg(v) = |미방문 이웃| + (head 인접 1)."""
    if remaining <= 0:
        return False
    low, first = 0, None
    for v in range(len(vis)):
        if vis[v] or not b.open[v]:
            continue
        if first is None:
            first = v
        adj = b.adj[v]
        near = head in adj
        d = sum(1 for u in adj if not vis[u]) + near
        if b.end is None:
            if d == 0 and not (remaining == 1 and near):
                return True
            if d <= 1:
                low += 1
                if low >= 2:
                    return True
        elif v != b.end and d <= 1:
            return True
        elif d == 0 and not (remaining == 1 and near):
            return True
    # 미방문 영역 연결성
    seen, stack = {first}, [first]
    while stack:
        x = stack.pop()
        for u in b.adj[x]:
            if not vis[u] and u not in seen:
                seen.add(u)
                stack.append(u)
    return len(seen) != remaining


def _step_ok(b, vis, length, c):
    """E는 마지막 칸에만, 경유점은 앞 경유점을 모두 지난 뒤에만."""
    if b.end is not None and c == b.end and length + 1 != b.n:
        return False
    j = b.wp_rank.get(c)
    return not j or all(vis[x] for x in b.wps[:j])


def dfs(b, prefix, rng=None, k=0, budget=300000):
    """prefix에서 해밀턴 경로 탐색 → ('found', path) | ('none', None) | ('budget', None).
    후보 = 진행 차수 오름차순(Warnsdorff), 동점 목록은 rng.shuffle k회(k=0 = 행우선)."""
    vis = [False] * len(b.open)
    for c in prefix:
        vis[c] = True
    path = list(prefix)
    cnt = [0]

    def rec():
        if len(path) == b.n:
            return True
        cnt[0] += 1
        if cnt[0] > budget:
            raise Budget
        head = path[-1]
        keyed = []
        for c in b.adj[head]:
            if not vis[c] and _step_ok(b, vis, len(path), c):
                keyed.append((sum(1 for u in b.adj[c] if not vis[u]), c))
        keyed.sort()
        cands = []
        for _, g in groupby(keyed, key=lambda x: x[0]):
            grp = [c for _, c in g]
            if rng is not None and len(grp) > 1:
                for _ in range(k):
                    rng.shuffle(grp)
            cands.extend(grp)
        for c in cands:
            vis[c] = True
            path.append(c)
            if not pruned(b, vis, c, b.n - len(path)) and rec():
                return True
            vis[c] = False
            path.pop()
        return False

    if len(path) > 1 and pruned(b, vis, path[-1], b.n - len(path)):
        return 'none', None
    try:
        return ('found', path) if rec() else ('none', None)
    except Budget:
        return 'budget', None


def dir_status(b, start, second, budget):
    """두 번째 칸 고정 DFS → 'found' | 'none' | 'budget'."""
    vis = [False] * len(b.open)
    vis[start] = True
    if not _step_ok(b, vis, 1, second):
        return 'none'
    return dfs(b, [start, second], budget=budget)[0]


def p_judge(b, start, known=None, budget=300000):
    """P 판정(⑦): S 인접 열린 칸마다 두 번째 칸 고정 DFS. known = 이미 해가 있는 두 번째 칸(생략).
    예산 초과 방향은 2배 예산으로 1회 재시도. → (P, pBudgetFail) — P None = 판정 불가."""
    unresolved = False
    for s2 in b.adj[start]:
        if s2 == known:
            continue
        st = dir_status(b, start, s2, budget)
        if st == 'budget':
            st = dir_status(b, start, s2, 2 * budget)
        if st == 'none':
            return 1, False
        if st == 'budget':
            unresolved = True
    return (None, True) if unresolved else (0, False)
