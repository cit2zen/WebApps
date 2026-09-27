import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../js/aimbuf.js';

test('push: 300ms보다 오래된 표본을 지우되 마지막 1개는 남긴다', () => {
  const buf = [];
  B.push(buf, 0, 100); B.push(buf, 100, 110); B.push(buf, 200, 120);
  B.push(buf, 450, 130);
  assert.deepEqual(buf.map(s => s.t), [200, 450]);
  const one = B.push([], 0, 50);
  B.push(one, 1000, 60);
  assert.deepEqual(one, [{ t: 1000, x: 60 }]);
});

test('push: 최대 64개', () => {
  const buf = [];
  for (let i = 0; i < 100; i++) B.push(buf, i, i);
  assert.equal(buf.length, 64);
  assert.equal(buf[63].t, 99);
});

test('releaseX: t ≤ tUp−80 인 마지막 표본, 없으면 buf[0]', () => {
  const buf = [{ t: 0, x: 100 }, { t: 50, x: 120 }, { t: 100, x: 200 }];
  assert.equal(B.releaseX(buf, 140), 120);
  assert.equal(B.releaseX(buf, 180), 200);
  assert.equal(B.releaseX(buf, 60), 100);
});

test('탭 120ms·바 150px·힌트 40px 경계', () => {
  assert.equal(B.isShortTap(0, 119.9), true);
  assert.equal(B.isShortTap(0, 120), false);
  assert.equal(B.inBar(694, 844), true);
  assert.equal(B.inBar(693.9, 844), false);
  assert.equal(B.nearBar(654, 844), true);
  assert.equal(B.nearBar(653.9, 844), false);
  assert.equal(B.nearBar(694, 844), false);
});

test('상대·절대 매핑과 25~365 clamp', () => {
  assert.equal(B.relX(195, 60, 1), 255);
  assert.equal(B.relX(195, 60, 0.5), 315);
  assert.equal(B.relX(350, 100, 1), 365);
  assert.equal(B.relX(30, -100, 1), 25);
  assert.equal(B.absX(200, 0, 1), 200);
  assert.ok(Math.abs(B.absX(100, 50, 1.5) - 33.3333) < 1e-3);
});

test('회전 홀드 반복: 350ms 뒤 첫 반복, 이후 150ms마다', () => {
  assert.deepEqual([0, 349, 350, 499, 500, 649, 650].map(t => B.repeatDue(0, t)), [0, 0, 1, 1, 2, 2, 3]);
});

test('휠 80ms 스로틀과 방향', () => {
  assert.equal(B.wheelOk(0, 79), false);
  assert.equal(B.wheelOk(0, 80), true);
  assert.deepEqual([B.wheelDir(100), B.wheelDir(-3), B.wheelDir(0)], [1, -1, 0]);
});
