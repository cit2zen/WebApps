import { test } from 'node:test';
import assert from 'node:assert/strict';

// 손상된 값·접근 예외 경로. storage.js를 쿼리 문자열로 새 인스턴스로 불러온다
const mem = new Map([['doltap:v1', '{broken json']]);
let throwAll = false;
globalThis.localStorage = {
  getItem: k => { if (throwAll) throw new Error('SecurityError'); return mem.has(k) ? mem.get(k) : null; },
  setItem: (k, v) => { if (throwAll) throw new Error('QuotaExceededError'); mem.set(k, String(v)); },
  removeItem: k => { if (throwAll) throw new Error('SecurityError'); mem.delete(k); },
};

test('JSON 손상이면 기본 객체로 시작하고 다음 쓰기에서 덮어쓴다', async () => {
  const st = await import('../../js/storage.js?broken');
  assert.equal(st.load().v, 1);
  assert.equal(st.persist(), true);
  st.set('vibe', false);
  assert.equal(JSON.parse(mem.get('doltap:v1')).vibe, false);
});

test('v !== 1이면 기본 객체', async () => {
  mem.set('doltap:v1', JSON.stringify({ v: 2, streak: 9, days: {} }));
  const st = await import('../../js/storage.js?v2');
  assert.equal(st.load().streak, 0);
});

test('localStorage 예외: persist()=false, 메모리로 동작, displayStreak = max(1, streak)', async () => {
  throwAll = true;
  const st = await import('../../js/storage.js?throws');
  assert.equal(st.persist(), false);
  assert.equal(st.displayStreak('20261001'), 1);
  assert.equal(st.bumpTries('20261001'), 1);
  assert.equal(st.commitResult('20261001', { Y: 2, H: 1, c: 10, left: 1, perfect: 0, fell: 0, skipped: false, grid: 'E'.repeat(24) }).streak, 1);
  assert.equal(st.commitResult('20261002', { Y: 2, H: 1, c: 10, left: 1, perfect: 0, fell: 0, skipped: false, grid: 'E'.repeat(24) }).streak, 2);
  assert.equal(st.displayStreak('20261010'), 2);
  assert.equal(st.wipe(), true);
});
