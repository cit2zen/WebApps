import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKST, setToday, nOf, prevDay, addDays, dDay, isDay, daily, LAUNCH } from '../../js/daily.js';

const realKST = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');

test('nOf: 20261001 = #1, 20261231 = #92, 20260930 = 0 / dDay', () => {
  assert.equal(LAUNCH, '20261001');
  assert.equal(nOf('20261001'), 1);
  assert.equal(nOf('20261231'), 92);
  assert.equal(nOf('20260930'), 0);
  assert.equal(dDay('20260930'), 1);
  assert.equal(dDay('20260926'), 5);
});

test('prevDay/addDays: 월·연 경계와 윤년', () => {
  assert.equal(prevDay('20261001'), '20260930');
  assert.equal(prevDay('20270101'), '20261231');
  assert.equal(addDays('20280228', 1), '20280229');
  assert.equal(addDays('20261001', 364), '20270930');
});

test('isDay: 형식 + 실제 날짜 왕복', () => {
  assert.ok(isDay('20261001'));
  for (const bad of ['2026101', '202610011', '20261301', '20260230', '2026-10-1', 'abcdefgh', null]) {
    assert.equal(isDay(bad), false, String(bad));
  }
});

test('todayKST는 UTC+9 기준 YYYYMMDD', () => {
  setToday(null);
  assert.equal(todayKST(), realKST());
});

test('setToday 전후 #N', () => {
  assert.equal(setToday('20261005'), '20261005');
  assert.equal(daily().n, 5);
  assert.equal(daily().day, '20261005');
  assert.equal(setToday('2026-10-05'), '20261005');   // 형식 오류는 무시(덮어쓰기 유지)
  assert.equal(setToday('20260920'), '20260920');
  assert.equal(daily().n, -10);
  assert.equal(setToday(null), realKST());
});

test('daily(day) = generate(fnv(day), day, nOf(day))', () => {
  const d = daily('20261001');
  assert.equal(d.seed, 1568161157); assert.equal(d.n, 1); assert.equal(d.day, '20261001');
});
