import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// 구형 엔진(iOS < 15.4·Chrome < 93) 호환: Object.hasOwn(ES2022)이 없어도 storage.set이 동작해야 한다.
// storage.js를 쿼리 문자열로 새 인스턴스로 불러오고, 호출 동안 Object.hasOwn을 지운다
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};

test('Object.hasOwn 없이도 set 허용·거부가 그대로', async () => {
  const saved = Object.hasOwn;
  Object.hasOwn = undefined;
  try {
    const st = await import('../../js/storage.js?compat');
    st.wipe();
    assert.equal(st.set('tutDone', true), true);
    assert.equal(st.set('sound', false), false);
    assert.equal(JSON.parse(mem.get('doltap:v1')).tutDone, true);
    assert.throws(() => st.set('constructor', 1), TypeError);   // 상속 키 거부 유지
    assert.throws(() => st.set('bestEver', 1), TypeError);
  } finally {
    Object.hasOwn = saved;
  }
});

test('js/ 소스 어디에도 Object.hasOwn이 없다', () => {
  const dir = new URL('../../js/', import.meta.url);
  const hits = readdirSync(dir).filter(f => f.endsWith('.js'))
    .filter(f => /Object\.hasOwn\b/.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(hits, []);
});
