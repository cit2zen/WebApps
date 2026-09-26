import test from 'node:test';
import assert from 'node:assert/strict';
import { daily } from '../../js/daily.js';
import { rotCW } from '../../js/stones.js';
import { ridgePhases, ridgeY, lowPoint, ringRadius } from '../../js/scene.js';
import { rockTop, ROCK, sx, sy } from '../../js/render.js';

test('능선 위상 9개: 결정적, [0, 2π)', () => {
  const a = ridgePhases(1568161157), b = ridgePhases(1568161157);
  assert.equal(a.length, 9);
  assert.deepEqual(a, b);
  assert.ok(a.every(p => p >= 0 && p < 2 * Math.PI));
  assert.notDeepEqual(a, ridgePhases(1));
});

test('능선 깊이 = base·Hv ± 진폭 합', () => {
  const ph = ridgePhases(7);
  for (let x = 0; x <= 390; x += 13) {
    assert.ok(Math.abs(ridgeY(0, x, 844, ph) - 0.55 * 844) <= 65 + 1e-9);
    assert.ok(Math.abs(ridgeY(1, x, 844, ph) - 0.65 * 844) <= 45 + 1e-9);
    assert.ok(Math.abs(ridgeY(2, x, 844, ph) - 0.75 * 844) <= 29 + 1e-9);
  }
});

test('lowPoint = rotCW로 돌린 로컬 꼭짓점 중 y 최소 (rayDown x0 기준)', () => {
  const s = daily('20261001').stones[0];
  for (const aDeg of [0, 15, 90, 195, 345]) {
    const k = aDeg / 15, pts = s.verts.map(([x, y]) => rotCW([x - s.cx, y - s.cy], k));
    const minY = Math.min(...pts.map(p => p[1]));
    const [lx, ly] = lowPoint(s, aDeg);
    assert.equal(ly, minY);
    assert.ok(pts.some(p => p[0] === lx && p[1] === ly));
  }
  assert.ok(ringRadius(s) > 20 && ringRadius(s) < 60);
});

test('바위 윗면(규칙 5)과 화면 변환: 390×844에서 바위 694·첫 스폰 514', () => {
  assert.equal(ROCK.length, 7);
  assert.equal(rockTop(195), 0);
  assert.equal(rockTop(95), -6);
  assert.equal(rockTop(295), -6);
  assert.equal(rockTop(165), -1);
  const P = { k: 1, ox: 0, base: 844 - 150, camOff: 0 };
  assert.equal(sy(P, 0), 694);
  assert.equal(sy(P, 0 + 180), 514);
  assert.equal(sx(P, 195), 195);
  const P2 = { k: 1.5, ox: (1366 - 585) / 2, base: 650 - 150, camOff: 10 };
  assert.equal(sx(P2, 0), 390.5);
  assert.equal(sy(P2, 10), 500);
});
