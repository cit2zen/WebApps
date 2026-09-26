import test from 'node:test';
import assert from 'node:assert/strict';
import { CAP, KIND, burst, update, count, items, clear } from '../../js/fx.js';

test('흙먼지 12·금가루 20, 수명 0.5s·0.8s', () => {
  clear();
  assert.equal(KIND.dust.n, 12);
  assert.equal(KIND.gold.n, 20);
  assert.equal(burst('dust', 195, 0, () => 0.5), 12);
  assert.equal(burst('gold', 195, 40, () => 0.5), 20);
  assert.equal(count(), 32);
  update(0.49);
  assert.equal(count(), 32);
  update(0.02);            // 0.51s: 흙먼지 만료
  assert.equal(count(), 20);
  assert.ok(items().every(p => p.kind === 'gold'));
  update(0.3);             // 0.81s: 금가루 만료
  assert.equal(count(), 0);
});

test('상한 60: 넘치면 가장 오래된 것부터 제거', () => {
  clear();
  burst('dust', 0, 0);     // 12 (가장 오래됨)
  burst('gold', 1, 0);     // 32
  burst('gold', 2, 0);     // 52
  burst('gold', 3, 0);     // 72 → 60
  assert.equal(CAP, 60);
  assert.equal(count(), 60);
  const xs = items().map(p => p.x);
  assert.ok(!xs.some(x => x === 0), '흙먼지 12개가 먼저 빠진다');
  assert.equal(xs.filter(x => x === 3).length, 20);
});

test('중력: 위로 쏜 입자는 속도가 줄고 y가 오른다, dt 0은 무시', () => {
  clear();
  burst('gold', 100, 0, () => 1);   // vx=+55, vy=170
  update(0.1);
  const p = items()[0];
  assert.ok(p.y > 0 && p.vy < 170 && p.x > 100);
  update(0);
  assert.equal(items()[0].t, p.t);
  clear();
  assert.equal(count(), 0);
  assert.equal(burst('nope', 0, 0), 0);
});
