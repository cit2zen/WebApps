import test from 'node:test';
import assert from 'node:assert/strict';
import { mapKey, keySpeed, init, onKey, poll } from '../../js/keys.js';

const ev = (code, o = {}) => ({
  type: 'keydown', code, repeat: false, isComposing: false, timeStamp: 1000,
  preventDefault() { this.dp = true; }, ...o,
});
const env = (state, o = {}) => ({ state, dialog: null, focus: 'body', ...o });
const AIM = env('aim');

test('플레이 상태 매핑', () => {
  assert.deepEqual(mapKey(ev('ArrowLeft'), AIM), { t: 'moveKey', dir: -1, down: true });
  assert.deepEqual(mapKey(ev('KeyD', { type: 'keyup' }), AIM), { t: 'moveKey', dir: 1, down: false });
  assert.deepEqual(mapKey(ev('ArrowUp'), AIM), { t: 'rot', d: 1 });
  assert.deepEqual(mapKey(ev('KeyX'), AIM), { t: 'rot', d: 1 });
  assert.deepEqual(mapKey(ev('KeyZ'), AIM), { t: 'rot', d: -1 });
  for (const c of ['Space', 'ArrowDown', 'Enter', 'NumpadEnter']) assert.deepEqual(mapKey(ev(c), AIM), { t: 'drop' });
  assert.equal(mapKey(ev('Space', { repeat: true }), AIM), null);
  assert.deepEqual(mapKey(ev('Backspace'), AIM), { t: 'cancel', x: 195 });
  assert.deepEqual(mapKey(ev('KeyQ', { timeStamp: 42 }), AIM), { t: 'skipTap', at: 42 });
  assert.deepEqual(mapKey(ev('Escape'), env('hold')), { t: 'pause' });
  assert.deepEqual(mapKey(ev('KeyP'), env('settle')), { t: 'pause' });
  assert.deepEqual(mapKey(ev('KeyM'), AIM), { t: 'mute' });
  assert.equal(mapKey(ev('Space', { type: 'keyup' }), AIM), null);
});

test('IME 조합·textarea 포커스는 무시', () => {
  assert.equal(mapKey(ev('Space', { isComposing: true }), AIM), null);
  assert.equal(mapKey(ev('KeyS'), env('result', { focus: 'textarea' })), null);
});

test('대화상자 규칙: Escape→closeTop, 최상단 S9일 때만 P→resume', () => {
  assert.deepEqual(mapKey(ev('Escape'), env('paused', { dialog: 'S9' })), { t: 'closeTop' });
  assert.deepEqual(mapKey(ev('KeyP'), env('paused', { dialog: 'S9' })), { t: 'resume' });
  assert.equal(mapKey(ev('KeyP'), env('paused', { dialog: 'S5' })), null);
  assert.equal(mapKey(ev('Space'), env('lobby', { dialog: 'S3' })), null);
});

test('로비·결과·일시정지(대화상자 없음) 매핑', () => {
  assert.deepEqual(mapKey(ev('Enter'), env('lobby')), { t: 'today' });
  assert.equal(mapKey(ev('Enter'), env('lobby', { focus: 'other' })), null);
  assert.deepEqual(mapKey(ev('KeyM'), env('lobby')), { t: 'mute' });
  assert.equal(mapKey(ev('Space'), env('lobby')), null);
  assert.deepEqual(mapKey(ev('KeyS'), env('result')), { t: 'share' });
  assert.deepEqual(mapKey(ev('KeyR'), env('result')), { t: 'retry' });
  assert.equal(mapKey(ev('KeyR'), AIM), null);
  assert.deepEqual(mapKey(ev('Escape'), env('paused')), { t: 'resume' });
  assert.deepEqual(mapKey(ev('KeyM'), env('paused')), { t: 'mute' });
  assert.equal(mapKey(ev('ArrowLeft'), env('paused')), null);
});

test('keySpeed: 150ms 대기 → 120px/s 시작, +480px/s², 최대 360', () => {
  assert.deepEqual([0.1, 0.15, 0.4, 0.65, 2].map(keySpeed), [0, 120, 240, 360, 360]);
});

test('onKey: 2px 즉시 이동·가속 poll·keyup 정지', () => {
  const out = [];
  init({ getEnv: () => AIM, onAction: a => out.push(a), target: null });
  onKey(ev('ArrowRight'));
  assert.deepEqual(out, [{ t: 'move', dx: 2 }]);
  poll(0.1);
  assert.equal(out.length, 1);
  poll(0.1);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[1].dx - 144 * 0.1) < 1e-9);
  onKey(ev('ArrowRight', { type: 'keyup' }));
  poll(0.1);
  assert.equal(out.length, 2);
});

test('onKey: 회전 auto-repeat 150ms 제한', () => {
  const out = [];
  init({ getEnv: () => AIM, onAction: a => out.push(a), target: null });
  onKey(ev('ArrowUp', { timeStamp: 1000 }));
  onKey(ev('ArrowUp', { timeStamp: 1100, repeat: true }));
  onKey(ev('ArrowUp', { timeStamp: 1160, repeat: true }));
  assert.equal(out.filter(a => a.t === 'rot').length, 2);
});

test('onKey: 플레이 상태의 Space/Enter/NumpadEnter는 preventDefault, 그 밖은 규칙대로', () => {
  init({ getEnv: () => AIM, onAction: () => {}, target: null });
  for (const e of [ev('Space'), ev('Enter', { repeat: true }), ev('NumpadEnter', { type: 'keyup' }), ev('KeyQ')]) {
    onKey(e); assert.equal(e.dp, true, e.code);
  }
  const tab = ev('Tab'); onKey(tab); assert.equal(tab.dp, undefined);
  init({ getEnv: () => env('lobby'), onAction: () => {}, target: null });
  const sp = ev('Space'); onKey(sp); assert.equal(sp.dp, undefined);
  init({ getEnv: () => env('paused', { dialog: 'S9' }), onAction: () => {}, target: null });
  const en = ev('Enter'); onKey(en); assert.equal(en.dp, undefined);
});
