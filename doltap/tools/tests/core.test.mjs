import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeMatter, fakeWorld, fakeSet } from './fake_matter.mjs';
installFakeMatter();
const { createRun, T } = await import('../../js/core.js');

const EVTS = ['land', 'fall', 'perfect', 'combo0', 'milestone', 'stable', 'aim', 'skip', 'hold', 'holdTick', 'done', 'firstDrop', 'height'];
function mk() {
  const W = fakeWorld();
  const R = createRun(fakeSet(), { mode: 'practice', W });
  const ev = [];
  for (const e of EVTS) R.on(e, p => ev.push([e, p]));
  return { W, R, ev };
}
const until = (R, pred, max = 30000) => { let n = 0; while (!pred(R.view()) && n < max) { R.step(); n++; } return n; };
const names = ev => ev.map(e => e[0]);
const missDrop = R => { R.dispatch({ t: 'setX', x: 30 }); R.dispatch({ t: 'drop' }); };   // 가짜 월드: x<95 → 낙석

test('시작: aim·slot 1·촛불 3·x 195·aDeg 0·600스텝, 첫 step에서 aim 이벤트', () => {
  const { R, ev } = mk();
  const v = R.view();
  assert.equal(v.state, 'aim'); assert.equal(v.slot, 1); assert.equal(v.candles, 3);
  assert.deepEqual(v.aim, { x: 195, aDeg: 0, stepsLeft: 600 });
  R.step();
  assert.deepEqual(ev[0], ['aim', { slot: 1, next: [2, 3] }]);
});

test('aim 액션: move·setX는 25~365 clamp, rot ±15(0~345), cancel', () => {
  const { R } = mk();
  R.dispatch({ t: 'move', dx: -500 }); assert.equal(R.view().aim.x, 25);
  R.dispatch({ t: 'setX', x: 999 }); assert.equal(R.view().aim.x, 365);
  R.dispatch({ t: 'cancel', x: 195 }); assert.equal(R.view().aim.x, 195);
  R.dispatch({ t: 'rot', d: -1 }); assert.equal(R.view().aim.aDeg, 345);
  R.dispatch({ t: 'rot', d: 1 }); R.dispatch({ t: 'rot', d: 1 }); assert.equal(R.view().aim.aDeg, 15);
});

test('drop → 첫 접촉 land → settle → 30스텝 안정 → 다음 aim', () => {
  const { W, R, ev } = mk();
  R.dispatch({ t: 'rot', d: 1 }); R.dispatch({ t: 'setX', x: 200 }); R.dispatch({ t: 'drop' });
  assert.equal(R.view().state, 'drop');
  assert.deepEqual(W.drops[0], { i: 1, x: 200, spawnY: 180, aDeg: 15 });
  R.step(); assert.equal(R.view().state, 'settle');
  for (let k = 0; k < T.CALM - 1; k++) R.step();
  assert.equal(R.view().state, 'settle');
  R.step();
  const v = R.view();
  assert.equal(v.state, 'aim'); assert.equal(v.slot, 2); assert.equal(v.Y, 10); assert.equal(v.combo, 1);
  assert.deepEqual(v.aim, { x: 195, aDeg: 0, stepsLeft: 600 });      // 새 돌은 aDeg 0·x 195
  assert.deepEqual(names(ev), ['aim', 'firstDrop', 'land', 'height', 'perfect', 'stable', 'aim']);
  R.dispatch({ t: 'drop' });
  assert.equal(W.drops[1].spawnY, 190);                               // 스폰 = 최고점 + 180
});

test('settle 중 rot는 버퍼 1개 → 다음 aim 진입 스텝에 즉시 적용, 나머지 액션 무시', () => {
  const { W, R } = mk();
  R.dispatch({ t: 'drop' }); R.step();
  assert.equal(R.view().state, 'settle');
  R.dispatch({ t: 'rot', d: 1 }); R.dispatch({ t: 'rot', d: 1 }); R.dispatch({ t: 'rot', d: -1 });
  R.dispatch({ t: 'drop' }); R.dispatch({ t: 'setX', x: 50 }); R.dispatch({ t: 'skip' });
  assert.equal(W.drops.length, 1); assert.equal(R.view().skipUsed, false);
  until(R, v => v.state === 'aim');
  assert.deepEqual(R.view().aim, { x: 195, aDeg: 15, stepsLeft: 600 });
});

test('drop 상태의 rot는 버퍼에 담지 않는다', () => {
  const { R } = mk();
  missDrop(R);
  R.dispatch({ t: 'rot', d: 1 });
  until(R, v => v.state === 'aim');
  assert.equal(R.view().aim.aDeg, 0);
});

test('조준 600스텝 만료 → 현재 x·각도로 자동 낙하', () => {
  const { W, R } = mk();
  R.dispatch({ t: 'setX', x: 250 }); R.dispatch({ t: 'rot', d: 1 });
  for (let k = 0; k < T.AIM - 1; k++) R.step();
  assert.equal(R.view().state, 'aim'); assert.equal(R.view().aim.stepsLeft, 1);
  R.step();
  assert.equal(R.view().state, 'drop');
  assert.deepEqual(W.drops[0], { i: 1, x: 250, spawnY: 180, aDeg: 15 });
});

test('낙석: 촛불 −1·콤보 0·X 기록, 첫 접촉이 없으면 90스텝 뒤 settle', () => {
  const { R, ev } = mk();
  R.dispatch({ t: 'drop' }); until(R, v => v.state === 'aim');     // 슬롯 1 퍼펙트 → combo 1
  missDrop(R);
  R.step();
  assert.equal(R.view().candles, 2); assert.equal(R.view().combo, 0);
  assert.equal(until(R, v => v.state === 'settle'), T.DROP - 1);
  assert.deepEqual(ev.find(e => e[0] === 'fall')[1], { slot: 2, candles: 2 });
  assert.ok(names(ev).includes('combo0'));
  until(R, v => v.state === 'aim');
  assert.equal(R.result().grid.slice(0, 3), 'PXE');
});

test('건너뛰기: 판당 1회, 슬롯 E, skip 이벤트', () => {
  const { R, ev } = mk();
  R.dispatch({ t: 'skip' });
  assert.equal(R.view().slot, 2); assert.equal(R.view().skipUsed, true);
  R.dispatch({ t: 'skip' });
  assert.equal(R.view().slot, 2);
  assert.deepEqual(ev.filter(e => e[0] === 'skip'), [['skip', { slot: 1 }]]);
  assert.equal(R.result().grid[0], 'E'); assert.equal(R.result().skipped, true);
});

test('촛불 0 → hold(candles) → holdTick 2·1 → 180스텝 done, hold 중 입력 무시', () => {
  const { R, ev } = mk();
  for (let k = 0; k < 3; k++) { missDrop(R); until(R, v => v.state === 'aim' || v.state === 'hold'); }
  assert.equal(R.view().state, 'hold'); assert.equal(R.view().candles, 0);
  R.dispatch({ t: 'skip' });
  assert.equal(R.view().skipUsed, false);
  assert.equal(until(R, v => v.state === 'done'), T.HOLD);
  const tail = ev.filter(e => ['hold', 'holdTick', 'done'].includes(e[0]));
  assert.deepEqual(tail.slice(0, 3), [['hold', { reason: 'candles' }], ['holdTick', { t: 2 }], ['holdTick', { t: 1 }]]);
  const r = tail[3][1];
  assert.equal(r.grid, 'XXX' + 'E'.repeat(21));
  assert.equal(r.fell, 3); assert.equal(r.left, 0); assert.equal(r.H, 0);
  const before = R.view(); R.step(); assert.deepEqual(R.view(), before);   // done 뒤 step은 무동작
});

test('24슬롯 처리 → hold(done) → 결과, 마일스톤 50·100cm 각 1회, firstDrop 1회', () => {
  const { R, ev } = mk();
  until(R, v => { if (v.state === 'aim') R.dispatch({ t: 'drop' }); return v.state === 'done'; });
  const r = R.result();
  assert.equal(r.grid, 'P'.repeat(24)); assert.equal(r.left, 24); assert.equal(r.perfect, 24);
  assert.equal(r.Y, 240); assert.equal(r.H, 120); assert.equal(r.c, 1200);
  assert.deepEqual(ev.find(e => e[0] === 'hold')[1], { reason: 'done' });
  assert.deepEqual(ev.filter(e => e[0] === 'milestone').map(e => e[1].cm), [50, 100]);
  assert.equal(ev.filter(e => e[0] === 'firstDrop').length, 1);
  const aims = ev.filter(e => e[0] === 'aim');
  assert.equal(aims.length, 24);
  assert.deepEqual(aims.at(-1)[1], { slot: 24, next: [] });
});

test('24번째 돌 건너뛰기 → 곧바로 hold(done)', () => {
  const { R, ev } = mk();
  until(R, v => { if (v.state === 'aim' && v.slot < 24) R.dispatch({ t: 'drop' }); return v.state === 'aim' && v.slot === 24; });
  R.dispatch({ t: 'skip' });
  assert.equal(R.view().state, 'hold');
  assert.deepEqual(ev.at(-1), ['hold', { reason: 'done' }]);
  assert.equal(R.result().grid[23], 'E');
});

test('알 수 없는 이벤트 이름은 throw', () => {
  const { R } = mk();
  assert.throws(() => R.on('nope', () => {}), /unknown event/);
});
