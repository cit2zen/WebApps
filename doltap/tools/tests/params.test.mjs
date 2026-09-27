import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setToday, parseParams } from '../../js/daily.js';

test('parseParams ?d= 오늘=공식·과거=연습·미래/오류=무시 (setToday 전후)', () => {
  setToday('20261005');
  assert.deepEqual(parseParams('?d=20261005'), { day: '20261005', past: false, friendC: null, friendH: null });
  assert.deepEqual(parseParams('?d=20261003&c=1485'), { day: '20261003', past: true, friendC: 1485, friendH: 148.5 });
  assert.deepEqual(parseParams('?d=20261006'), { day: '20261005', past: false, friendC: null, friendH: null });
  assert.equal(parseParams('?d=20260230').day, '20261005');
  assert.equal(parseParams('?d=2026100').day, '20261005');
  setToday('20261010');
  assert.deepEqual(parseParams('?d=20261006'), { day: '20261006', past: true, friendC: null, friendH: null });
  setToday(null);
});

test('parseParams ?c= 정규식·clamp', () => {
  const t = '20261005';
  assert.equal(parseParams('?c=99999', t).friendC, 99990);
  assert.equal(parseParams('?c=0', t).friendH, 0);
  assert.equal(parseParams('?c=00123', t).friendC, 123);
  for (const bad of ['?c=123456', '?c=-5', '?c=12.5', '?c=abc', '?c=', '?c=1e3', '?c=%3Cb%3E']) {
    assert.equal(parseParams(bad, t).friendC, null, bad);
  }
});
