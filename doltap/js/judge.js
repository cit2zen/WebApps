// judge.js — 안정·낙석·기하 인접 체인·최고점·받침돌·퍼펙트 판정(§6). DOM 없음.
// Matter는 호출 시점에 window.Matter로 읽는다(모듈 최상위 참조 없음).
export const CALM_SPEED = 0.15;       // px/step
export const CALM_ANG = 0.01;         // rad/step
export const FALL_Y = 40;             // Matter y(아래 +) > 40 → 낙석(바위 윗면 아래 40px)
export const PERFECT_TOL = 0.08;      // 받침돌 AABB 폭 × 0.08
export const GAP = 1.0;               // 꼭짓점–변 최소거리 ≤ 1.0 월드px 이면 인접

const M = () => window.Matter;

export function isCalm(bodies) {
  const { Body } = M();
  for (const b of bodies) {
    if (Body.getSpeed(b) >= CALM_SPEED || Body.getAngularSpeed(b) >= CALM_ANG) return false;
  }
  return true;
}

export const fallen = body => body.position.y > FALL_Y;

// 점 p 와 선분 ab 의 거리
export function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  let t = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = a.x + t * dx - p.x, qy = a.y + t * dy - p.y;
  return Math.sqrt(qx * qx + qy * qy);
}

// 두 다각형 사이 꼭짓점–변 최소거리(양방향)
export function minGap(va, vb) {
  let m = Infinity;
  for (const [P, Q] of [[va, vb], [vb, va]]) {
    for (const p of P) {
      for (let i = 0; i < Q.length; i++) {
        const d = segDist(p, Q[i], Q[(i + 1) % Q.length]);
        if (d < m) m = d;
      }
    }
  }
  return m;
}

const grow = (b, e) => ({ min: { x: b.min.x - e, y: b.min.y - e }, max: { x: b.max.x + e, y: b.max.y + e } });

export function adjacent(a, b) {
  const { Bounds, Collision } = M();
  if (!Bounds.overlaps(grow(a.bounds, GAP), b.bounds)) return false;
  return Collision.collides(a, b) !== null || minGap(a.vertices, b.vertices) <= GAP;
}

// 바위에서 시작하는 기하 인접 BFS. pair·sleeping 상태는 쓰지 않는다. 결과에 바위 포함.
export function chain(W) {
  const rest = W.stones();
  const seen = new Set([W.rock]);
  const queue = [W.rock];
  while (queue.length) {
    const cur = queue.shift();
    for (let i = rest.length - 1; i >= 0; i--) {
      if (adjacent(cur, rest[i])) { seen.add(rest[i]); queue.push(rest[i]); rest.splice(i, 1); }
    }
  }
  return seen;
}

// Matter bounds는 속도만큼 늘어나므로 높이·폭은 꼭짓점에서 직접 잰다.
const spanX = V => { let lo = Infinity, hi = -Infinity; for (const v of V) { if (v.x < lo) lo = v.x; if (v.x > hi) hi = v.x; } return hi - lo; };

// 체인 최고점 Y(월드 px, 위쪽 +). 바위 윗면 중앙 = 0 이 하한.
export function topY(chainSet) {
  let Y = 0;
  for (const b of chainSet) {
    if (b.isStatic) continue;
    for (const v of b.vertices) if (-v.y > Y) Y = -v.y;
  }
  return Y;
}

// 받침돌: body 와 인접한 돌 중 무게중심이 가장 위(Matter y 최소)인 것. 없으면 너럭바위.
export function support(W, body) {
  let best = null;
  for (const b of W.stones()) {
    if (b === body || !adjacent(body, b)) continue;
    if (!best || b.position.y < best.position.y) best = b;
  }
  const s = best || W.rock;
  return { x: s.position.x, w: spanX(s.vertices) };
}

export function isPerfect(W, body) {
  const s = support(W, body);
  return Math.abs(body.position.x - s.x) <= PERFECT_TOL * s.w;
}
