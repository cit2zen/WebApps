import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fnv, mulberry32 } from '../../js/rng.js';

test('fnv("20261001") = 1568161157 (실례 1 seed, 0x5D783D85)', () => {
  assert.equal(fnv('20261001'), 1568161157);
  assert.equal(fnv('20261001'), 0x5D783D85);
});

test('fnv 빈 문자열 = FNV offset basis', () => {
  assert.equal(fnv(''), 0x811c9dc5);
});

test('mulberry32는 [0,1) 결정적 스트림', () => {
  const a = mulberry32(1568161157), b = mulberry32(1568161157);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('실례 1 pattern: 첫 추첨 ≥ 0.5 → FAF', () => {
  assert.ok(mulberry32(1568161157)() >= 0.5);
});
