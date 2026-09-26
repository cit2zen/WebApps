import test from 'node:test';
import assert from 'node:assert/strict';
import { cmY, goalCm, reachedCms, crossed, popup, reset, popCount, drawPopups } from '../../js/flags.js';

// fillText 등은 아무것도 하지 않고 속성 대입만 받는 가짜 2D 컨텍스트
const fakeCtx = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => ({ width: 0 })),
  set: (t, k, v) => { t[k] = v; return true; }});
const Q = { k: 1, ox: 0, base: 694, camOff: 0, h: 844 };

test('높이 환산과 다음 50cm 목표', () => {
  assert.equal(cmY(100), 200);
  assert.equal(goalCm(0), 50);
  assert.equal(goalCm(49.9), 50);
  assert.equal(goalCm(50), 100);
  assert.equal(goalCm(148.5), 150);
});

test('리본은 도달한 50cm 배수마다', () => {
  assert.deepEqual(reachedCms(0), []);
  assert.deepEqual(reachedCms(148.5), [50, 100]);
  assert.deepEqual(reachedCms(250), [50, 100, 150, 200, 250]);
});

test('팝업은 100·200·300·400cm를 처음 넘을 때만', () => {
  assert.deepEqual(crossed(0, 99.9), []);
  assert.deepEqual(crossed(0, 100), [100]);
  assert.deepEqual(crossed(90, 310), [100, 200, 300]);
  assert.deepEqual(crossed(310, 320), []);
  assert.deepEqual(crossed(390, 520), [400]);
});

test('팝업은 900ms 뒤 제거', () => {
  reset();
  popup(100, 1000);
  assert.equal(popCount(), 1);
  drawPopups(fakeCtx(), Q, 1899);
  assert.equal(popCount(), 1);
  drawPopups(fakeCtx(), Q, 1900);
  assert.equal(popCount(), 0);
});
