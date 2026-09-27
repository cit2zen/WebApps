import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage 가짜 구현을 import 전에 설치한다
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};
const { setToday } = await import('../../js/daily.js');
const st = await import('../../js/storage.js');
const saved = () => JSON.parse(mem.get('doltap:v1'));
const run = (H, left, perfect, extra = {}) => ({ Y: H * 2, H, c: Math.round(H * 10), left, perfect,
  fell: 24 - left, skipped: false, grid: 'S'.repeat(24), day: 'x', mode: 'official', ...extra });

test('기본 객체와 persist()', () => {
  st.wipe();
  const S = st.load();
  assert.deepEqual(S, { v: 1, days: {}, streak: 0, maxStreak: 0, lastDay: null, bestEver: 0,
    sound: true, vibe: true, hand: 'R', tutDone: false });
  assert.equal(st.persist(), true);
});

test('bumpTries: 첫 낙하마다 +1, 상한 3, 즉시 저장', () => {
  setToday('20261001'); st.wipe();
  assert.equal(st.bumpTries('20261001'), 1);
  assert.equal(saved().days['20261001'].tries, 1);
  st.bumpTries('20261001'); st.bumpTries('20261001');
  assert.equal(st.bumpTries('20261001'), 3);
});

test('commitResult: best 사전식(H, left, perfect) 교체·bestEver·newBest', () => {
  setToday('20261001'); st.wipe();
  let r = st.commitResult('20261001', run(148.5, 19, 4));
  assert.deepEqual(r, { newBest: true, streak: 1 });
  assert.deepEqual(Object.keys(saved().days['20261001'].best), ['Y', 'H', 'c', 'left', 'perfect', 'fell', 'skipped', 'grid']);
  r = st.commitResult('20261001', run(148.5, 18, 9));          // H 같고 left 작음 → 교체 없음
  assert.equal(saved().days['20261001'].best.left, 19);
  assert.equal(r.newBest, false);
  st.commitResult('20261001', run(148.5, 19, 5));              // perfect만 큼 → 교체
  assert.equal(saved().days['20261001'].best.perfect, 5);
  st.commitResult('20261001', run(100, 24, 24));               // H 작음 → 유지
  assert.equal(saved().days['20261001'].best.H, 148.5);
  assert.equal(saved().bestEver, 148.5);
});

test('streak 규칙 18: 전날 +1 · 같은 날 유지 · 공백 뒤 1, maxStreak', () => {
  setToday('20261003'); st.wipe();
  assert.equal(st.commitResult('20261001', run(10, 1, 0)).streak, 1);
  assert.equal(st.commitResult('20261002', run(10, 1, 0)).streak, 2);
  assert.equal(st.commitResult('20261002', run(20, 1, 0)).streak, 2);
  assert.equal(st.commitResult('20261003', run(10, 1, 0)).streak, 3);
  assert.equal(st.commitResult('20261005', run(10, 1, 0)).streak, 1);
  assert.equal(saved().maxStreak, 3);
  assert.equal(saved().lastDay, '20261005');
});

test('displayStreak: lastDay가 오늘·어제면 streak, 아니면 0', () => {
  setToday('20261002'); st.wipe();
  st.commitResult('20261001', run(10, 1, 0));
  st.commitResult('20261002', run(10, 1, 0));
  assert.equal(st.displayStreak('20261002'), 2);
  assert.equal(st.displayStreak('20261003'), 2);
  assert.equal(st.displayStreak('20261004'), 0);
});

test('60일 정리: 쓰기마다 오늘 −59일보다 오래된 days 삭제', () => {
  setToday('20261001'); st.wipe();
  st.bumpTries('20261001');
  setToday('20261129');                       // 20261001 = 오늘 −59 → 유지
  st.bumpTries('20261129');
  assert.ok('20261001' in saved().days);
  setToday('20261130');                       // 20261001 = 오늘 −60 → 삭제
  st.bumpTries('20261130');
  assert.ok(!('20261001' in saved().days));
  assert.ok('20261129' in saved().days);
});

test('set: 설정 4종만, 타입 검사', () => {
  st.wipe();
  assert.equal(st.set('hand', 'L'), 'L');
  assert.equal(saved().hand, 'L');
  st.set('tutDone', true); st.set('sound', false); st.set('vibe', false);
  assert.equal(saved().tutDone, true);
  assert.throws(() => st.set('hand', 'X'));
  assert.throws(() => st.set('streak', 99));
  assert.throws(() => st.set('sound', 'yes'));
  assert.throws(() => st.set('constructor', 1), TypeError);   // 상속 키도 거부
});

test('wipe: 키 삭제 + 기본 객체', () => {
  st.set('tutDone', true);
  assert.equal(st.wipe(), true);
  assert.equal(mem.has('doltap:v1'), false);
  assert.equal(st.load().tutDone, false);
  setToday(null);
});
