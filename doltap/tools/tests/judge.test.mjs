import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeMatter, box, fakeWorld } from './fake_matter.mjs';
installFakeMatter();
const J = await import('../../js/judge.js');

test('isCalm: 속도 < 0.15, 각속도 < 0.01 (경계값은 불안정)', () => {
  assert.equal(J.isCalm([]), true);
  assert.equal(J.isCalm([box(195, 0, 10, 10, { speed: 0.149, angSpeed: 0.0099 })]), true);
  assert.equal(J.isCalm([box(195, 0, 10, 10, { speed: 0.15 })]), false);
  assert.equal(J.isCalm([box(195, 0, 10, 10, { angSpeed: 0.01 })]), false);
});

test('fallen: Matter y > 40 (바위 윗면 아래 40px 초과)', () => {
  assert.equal(J.fallen({ position: { x: 0, y: 40 } }), false);
  assert.equal(J.fallen({ position: { x: 0, y: 40.01 } }), true);
});

test('segDist·minGap', () => {
  assert.equal(J.segDist({ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }), 1);
  assert.equal(J.segDist({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }), 5);
  const a = box(0, 0, 10, 10).vertices, b = box(0, 10.5, 10, 10).vertices;
  assert.equal(J.minGap(a, b), 0.5);
});

test('adjacent: 간격 ≤ 1.0 이면 인접, 1.5 이면 아님', () => {
  assert.equal(J.adjacent(box(195, 0, 20, 10), box(195, 11, 20, 10)), true);
  assert.equal(J.adjacent(box(195, 0, 20, 10), box(195, 11.5, 20, 10)), false);
  assert.equal(J.adjacent(box(100, 0, 20, 10), box(300, 0, 20, 10)), false);
});

test('chain·topY: 바위에 이어진 돌만, 떠 있는 돌 제외', () => {
  const W = fakeWorld();
  const s1 = box(195, 0, 60, 10), s2 = box(195, 10, 60, 10), lone = box(195, 60, 60, 10);
  const c = J.chain({ rock: W.rock, stones: () => [s1, s2, lone] });
  assert.ok(c.has(W.rock) && c.has(s1) && c.has(s2));
  assert.equal(c.has(lone), false);
  assert.equal(J.topY(c), 20);
  assert.equal(J.topY(new Set([W.rock])), 0);
});

test('support·isPerfect: 받침 = 인접 돌 중 가장 위, 없으면 바위(폭 200)', () => {
  const W = fakeWorld();
  const s1 = box(195, 0, 50, 10);
  const top = box(199, 10, 30, 10);                          // 받침 s1 폭 50 → 허용 4.0
  const Wa = { rock: W.rock, stones: () => [s1, top] };
  assert.deepEqual(J.support(Wa, top), { x: 195, w: 50 });
  assert.equal(J.isPerfect(Wa, top), true);                  // |4| ≤ 0.08·50
  const off = box(199.01, 10, 30, 10);
  assert.equal(J.isPerfect({ rock: W.rock, stones: () => [s1, off] }, off), false);
  const first = box(211, 0, 30, 10);                         // 바위: 0.08·200 = 16
  const Wb = { rock: W.rock, stones: () => [first] };
  assert.deepEqual(J.support(Wb, first), { x: 195, w: 200 });
  assert.equal(J.isPerfect(Wb, first), true);
});
