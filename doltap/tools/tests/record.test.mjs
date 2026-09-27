import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecord, buildResult, cmp, toH, SLOTS } from '../../js/record.js';

// 실례 2(§5): grid "SPSSPSXSSSPSSSXSSPSSSXEE"
const EX = 'SPSSPSXSSSPSSSXSSPSSSXEE';
const fromGrid = g => {
  const rec = createRecord();
  [...g].forEach((c, k) => {
    const i = k + 1;
    if (c === 'S' || c === 'P' || c === 'X') rec.placed(i);
    if (c === 'P') rec.perfect(i);
    if (c === 'X') rec.fell(i);
  });
  return rec;
};

test('toH: H = round(5·Y)/10', () => {
  assert.equal(toH(297.0), 148.5);
  assert.equal(toH(0), 0);
  assert.equal(toH(296.96), 148.5);
  assert.equal(toH(12.34), 6.2);
});

test('새 기록은 24칸 모두 E', () => {
  const rec = createRecord();
  assert.equal(SLOTS, 24);
  assert.equal(rec.grid(), 'E'.repeat(24));
  assert.deepEqual(rec.counts(), { left: 0, perfect: 0, fell: 0 });
});

test('실례 2 grid·집계 재현', () => {
  const rec = fromGrid(EX);
  assert.equal(rec.grid(), EX);
  assert.deepEqual(rec.counts(), { left: 19, perfect: 4, fell: 3 });
});

test('퍼펙트였던 돌이 떨어지면 X (P 아님)', () => {
  const rec = createRecord();
  rec.placed(1); rec.perfect(1); rec.fell(1);
  assert.equal(rec.state(1), 'X');
  assert.equal(rec.grid()[0], 'X');
});

test('건너뛴 슬롯은 E', () => {
  const rec = createRecord();
  rec.skip(5);
  assert.equal(rec.grid()[4], 'E');
});

test('슬롯 범위 밖은 RangeError', () => {
  const rec = createRecord();
  assert.throws(() => rec.placed(0), RangeError);
  assert.throws(() => rec.placed(25), RangeError);
});

test('buildResult: 실례 2 RunResult', () => {
  const set = { day: '20261001', n: 1, seed: 1568161157, stones: [] };
  const r = buildResult({ set, mode: 'official', tryNo: 2, Y: 297.0, rec: fromGrid(EX), skipped: false });
  assert.deepEqual(r, { day: '20261001', n: 1, mode: 'official', try: 2, Y: 297.0, H: 148.5, c: 1485,
    left: 19, perfect: 4, fell: 3, skipped: false, grid: EX });
});

test('cmp: (H, left, perfect) 사전식', () => {
  const a = { H: 148.5, left: 19, perfect: 4 };
  assert.ok(cmp({ ...a, H: 148.6 }, a) > 0);
  assert.ok(cmp({ ...a, left: 20, perfect: 0 }, a) > 0);
  assert.ok(cmp({ ...a, perfect: 5 }, a) > 0);
  assert.ok(cmp({ ...a, H: 148.4, left: 24 }, a) < 0);
  assert.equal(cmp({ ...a }, a), 0);
});
