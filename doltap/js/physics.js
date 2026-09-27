// physics.js — Matter.js 0.20.0 래퍼. 월드 좌표(y 위쪽 +) ↔ Matter 좌표(y 아래쪽 +)는 이 파일 안에서만 바꾼다(my = −y).
// 모듈 최상위에서 window.Matter를 읽지 않는다(§6): createWorld() 안에서 const M = window.Matter.
import { centroid, hull } from './stones.js';

// 너럭바위 꼭짓점(월드, y 위쪽 +) — §2 규칙 5
export const ROCK = [[95, -6], [135, -2], [195, 0], [255, -2], [295, -6], [280, -150], [110, -150]];
export const STONE_OPTS = { density: 0.0025, friction: 0.85, frictionStatic: 1.2, restitution: 0, slop: 0.03, sleepThreshold: 60, frictionAir: 0.05 };
const ROCK_OPTS = { isStatic: true, friction: 0.85, frictionStatic: 1.2 };
const STEP_MS = 1000 / 60;

let hullCount = 0;                     // 볼록 재감싸기 누적(모든 월드 합) — __doltap.stats().reHulled
export const reHulled = () => hullCount;

const flip = V => V.map(([x, y]) => ({ x, y: -y }));          // 월드 [x,y] → Matter {x,y}
const unflip = V => V.map(v => [v.x, -v.y]);                  // Matter {x,y} → 월드 [x,y]

// 수직선 x = x0 와 다각형 변들의 교차 y(월드, y 위쪽 +)의 최댓값. 교차 없으면 −Infinity.
export function edgeTopAt(verts, x0) {
  let best = -Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const ax = a.x, ay = -a.y, bx = b.x, by = -b.y;
    if (x0 < Math.min(ax, bx) || x0 > Math.max(ax, bx)) continue;
    const y = ax === bx ? Math.max(ay, by) : ay + (by - ay) * (x0 - ax) / (bx - ax);
    if (y > best) best = y;
  }
  return best;
}

export function createWorld() {
  const M = window.Matter;
  const { Engine, Bodies, Body, Composite, Events, Sleeping, Vertices } = M;
  const engine = Engine.create({
    positionIterations: 10, velocityIterations: 8, enableSleeping: true,
    gravity: { x: 0, y: 1, scale: 0.001 },
  });
  const [RX, RY] = centroid(ROCK);                           // (195, −74.0477)
  const rock = Bodies.fromVertices(RX, -RY, flip(ROCK), ROCK_OPTS);
  if (Math.abs(rock.bounds.min.y) > 0.01) throw new Error('doltap: rock bounds.min.y=' + rock.bounds.min.y);
  Composite.add(engine.world, rock);

  const list = [];                                           // 월드에 있는 돌 바디(낙하 순)
  const contactFns = [];
  let pending = null;                                        // 첫 접촉을 기다리는 새 돌

  const partOwner = b => (b.parent && b.parent !== b ? b.parent : b);
  Events.on(engine, 'collisionStart', ev => {
    if (!pending) return;
    for (const p of ev.pairs) {
      const a = partOwner(p.bodyA), b = partOwner(p.bodyB);
      if (a !== pending && b !== pending) continue;
      const body = pending; pending = null;
      W.wakeChain();
      for (const fn of contactFns) fn(body);
      return;
    }
  });

  const W = {
    rock,
    dropStone(stone, x, spawnY, aDeg) {
      let body = Bodies.fromVertices(x, -spawnY, flip(stone.verts), STONE_OPTS);
      if (Vertices.isConvex(body.vertices) === false) {       // 재반올림으로 미세 오목 → hull로 다시 감쌈
        hullCount++;
        body = Bodies.fromVertices(x, -spawnY, flip(hull(unflip(body.vertices))), STONE_OPTS);
      }
      Body.setAngle(body, aDeg * Math.PI / 180);
      Body.setPosition(body, { x, y: -spawnY });
      body.slot = stone.i;
      Composite.add(engine.world, body);
      list.push(body);
      pending = body;
      return body;
    },
    step() { Engine.update(engine, STEP_MS); },
    remove(body) {
      const k = list.indexOf(body);
      if (k >= 0) list.splice(k, 1);
      if (pending === body) pending = null;
      Composite.remove(engine.world, body);
    },
    stones() { return list.slice(); },
    rayDown(x0) {
      let hit = null;
      for (const b of [rock, ...list]) {
        if (x0 < b.bounds.min.x || x0 > b.bounds.max.x) continue;
        const y = edgeTopAt(b.vertices, x0);
        if (y > -Infinity && (!hit || y > hit.y)) hit = { y, body: b };
      }
      return hit;
    },
    wakeChain() { for (const b of list) Sleeping.set(b, false); },
    onFirstContact(fn) { contactFns.push(fn); },
    destroy() {
      Events.off(engine, 'collisionStart');
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      list.length = 0; contactFns.length = 0; pending = null;
    },
  };
  return W;
}
