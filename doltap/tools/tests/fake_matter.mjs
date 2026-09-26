// fake_matter.mjs — Node 단위 테스트용 최소 Matter 대역(judge·core가 호출 시점에 읽는 API만).
// 바디는 월드 좌표(y 위쪽 +) 사각형/다각형으로 만들고, Matter 좌표(y 아래 +)로 뒤집어 보관한다.
export function installFakeMatter() {
  globalThis.window = globalThis.window || {};
  window.Matter = {
    Body: { getSpeed: b => b.speed || 0, getAngularSpeed: b => Math.abs(b.angSpeed || 0) },
    Bounds: { overlaps: (a, b) => a.min.x <= b.max.x && a.max.x >= b.min.x && a.max.y >= b.min.y && a.min.y <= b.max.y },
    Collision: { collides: () => null },
  };
}

export function fakeBody(worldVerts, extra = {}) {
  const vertices = worldVerts.map(([x, y]) => ({ x, y: -y }));
  const xs = vertices.map(v => v.x), ys = vertices.map(v => v.y);
  const bounds = { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
  const position = { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
  return { vertices, bounds, position, isStatic: false, angle: 0, isSleeping: false, ...extra };
}

export const box = (cx, y0, w, h, extra) =>
  fakeBody([[cx - w / 2, y0], [cx + w / 2, y0], [cx + w / 2, y0 + h], [cx - w / 2, y0 + h]], extra);

// 가짜 월드: dropStone은 돌을 spawn 위치가 아니라 현재 더미 꼭대기(10px 두께 상자)에 바로 쌓는다.
// step()마다 대기 중인 새 돌의 첫 접촉 콜백을 부른다. drop(): x가 95 미만이면 바위 밖 → 낙석 위치(y −100)에 둔다.
export function fakeWorld() {
  const rock = fakeBody([[95, 0], [295, 0], [280, -150], [110, -150]], { isStatic: true });
  rock.position = { x: 195, y: 74 };
  const list = [], fns = [];
  let pending = null, top = 0;
  const W = {
    rock, steps: 0, drops: [],
    dropStone(stone, x, spawnY, aDeg) {
      W.drops.push({ i: stone.i, x, spawnY, aDeg });
      const b = x < 95 ? box(x, -100, 20, 10) : box(x, top, 60, 10);
      if (x >= 95) top += 10;
      b.slot = stone.i; list.push(b); pending = x >= 95 ? b : null;
      return b;
    },
    step() { W.steps++; if (pending) { const b = pending; pending = null; for (const fn of fns) fn(b); } },
    remove(b) { const k = list.indexOf(b); if (k >= 0) list.splice(k, 1); },
    stones() { return list.slice(); },
    onFirstContact(fn) { fns.push(fn); },
    wakeChain() {}, destroy() {},
  };
  return W;
}

// 24개짜리 가짜 DailySet(core는 set.stones[i-1]·day·n·seed만 읽는다)
export const fakeSet = () => ({ day: '20261001', n: 1, seed: 1568161157,
  stones: Array.from({ length: 24 }, (_, k) => ({ i: k + 1, verts: [[-30, -5], [30, -5], [30, 5], [-30, 5]], cx: 0, cy: 0 })) });
