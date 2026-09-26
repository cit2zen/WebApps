import test from 'node:test';
import assert from 'node:assert/strict';
import { daily } from '../../js/daily.js';
import { localOf, boundsOf, inside, speckles, TONE } from '../../js/texture.js';
import { cacheSize } from '../../js/theme.js';

const sets = ['20261001', '20261002', '20261103'].map(d => daily(d));

test('로컬 좌표는 무게중심 기준, 톤 6종 매핑', () => {
  const s = sets[0].stones[0], V = localOf(s);
  assert.equal(V.length, s.verts.length);
  assert.ok(Math.abs(V[0][0] - (s.verts[0][0] - s.cx)) < 1e-12);
  assert.equal(Object.keys(TONE).length, 6);
  for (const set of sets) for (const st of set.stones) assert.ok(TONE[st.tone], st.tone);
  assert.ok(inside(V, 0, 0), '무게중심은 볼록 다각형 안');
  assert.ok(!inside(V, 500, 0));
});

test('반점 18~30개·hull 내부·결정적, 이끼 = moss개·상위 30% 띠', () => {
  for (const set of sets) for (const s of set.stones) {
    const a = speckles(set.seed, s), b = speckles(set.seed, s);
    assert.deepEqual(a, b);
    assert.ok(a.dots.length >= 18 && a.dots.length <= 30, `slot ${s.i}: ${a.dots.length}`);
    const V = localOf(s), bb = boundsOf(V);
    for (const d of a.dots) {
      assert.ok(inside(V, d.x, d.y));
      assert.ok(d.r >= 0.8 && d.r <= 2.0 && Math.abs(d.dl) <= 8);
    }
    assert.equal(a.moss.length, s.moss);
    for (const m of a.moss) {
      assert.ok(m.y >= bb.maxY - 0.3 * (bb.maxY - bb.minY) - 1e-9);
      assert.ok(inside(V, m.x, m.y));
    }
  }
});

test('캐시 한 변 ≤ 280px (cs 상한 2.4)', () => {
  for (const set of sets) for (const s of set.stones) {
    const bb = boundsOf(localOf(s));
    assert.ok(cacheSize(bb.maxX - bb.minX, 2.4) <= 280);
    assert.ok(cacheSize(bb.maxY - bb.minY, 2.4) <= 280);
  }
});
