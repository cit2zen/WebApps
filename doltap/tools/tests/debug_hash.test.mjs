import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stoneLine, hashDay, hashRange } from '../../js/debug_hash.js';

test('stoneLine 형식: type,attempts,tone,moss,verts(JSON)', () => {
  const line = stoneLine({ type: 'flat', attempts: 21, tone: 'stone-gray-l', moss: 2, verts: [[-36, 0], [18, -17.15]] });
  assert.equal(line, 'flat,21,stone-gray-l,2,[[-36,0],[18,-17.15]]');
});

test('hashDay 20261001 = ref_stones.py 첫 행 해시', async () => {
  assert.equal(await hashDay('20261001'), '32b43bbe21055ba516e0515163363458a627e442fe7837ba3b81aa3ddec71e56');
});

test('hashRange: 연 경계 day 순서, r0·r·s 24개', async () => {
  const rows = await hashRange('20261230', 3);
  assert.deepEqual(rows.map(r => r.day), ['20261230', '20261231', '20270101']);
  for (const r of rows) {
    assert.match(r.hash, /^[0-9a-f]{64}$/);
    assert.equal(r.r0.length, 24); assert.equal(r.r.length, 24); assert.equal(r.s.length, 24);
  }
});
