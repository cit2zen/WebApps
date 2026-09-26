import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load, pick, WISH_FALLBACK, TRAIL_FALLBACK } from '../../js/content.js';

const fix = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const okFetch = url => Promise.resolve({ ok: true, status: 200,
  json: async () => fix(url.includes('wishes') ? 'wishes' : 'trails') });
const warns = [];
console.warn = (...a) => warns.push(a.join(' '));

test('정상: 60/30 로드, 실례 1 인덱스(wishIdx 24, trailIdx 0)', async () => {
  const c = await load(okFetch);
  assert.equal(c.wishes.length, 60); assert.equal(c.trails.length, 30);
  assert.deepEqual(pick(c, { wishIdx: 24, trailIdx: 0 }),
    { wish: '준비한 만큼 다 보여 주기를', trail: '달빛암 앞 돌길', fallback: false });
  assert.equal(warns.length, 0);
});

test('fetch 실패 → 폴백 2개, warn 1회만', async () => {
  const c = await load(() => Promise.reject(new TypeError('offline')));
  assert.deepEqual(pick(c, { wishIdx: 5, trailIdx: 7 }),
    { wish: WISH_FALLBACK, trail: TRAIL_FALLBACK, fallback: true });
  await load(() => Promise.resolve({ ok: false, status: 404, json: async () => ({}) }));
  assert.equal(warns.length, 1);
  assert.equal(WISH_FALLBACK, '오늘도 무사히 내려가기를');
  assert.equal(TRAIL_FALLBACK, '이름 없는 산길');
});

test('스키마: 개수 ≠ 60 이면 전체 폴백, 선택 항목 정규식 불일치면 그 항목만 폴백', async () => {
  const short = await load(url => Promise.resolve({ ok: true, status: 200,
    json: async () => (url.includes('wishes') ? { version: 1, items: fix('wishes').items.slice(1) } : fix('trails')) }));
  assert.equal(short.wishes, null);
  assert.equal(pick(short, { wishIdx: 0, trailIdx: 0 }).trail, '달빛암 앞 돌길');
  const c = await load(okFetch);
  c.wishes[3] = { id: 'w04', text: 'Hello!', tone: '가족' };
  assert.equal(pick(c, { wishIdx: 3, trailIdx: 1 }).wish, WISH_FALLBACK);
  assert.equal(pick(c, { wishIdx: 4, trailIdx: 1 }).wish, '할머니 밥상이 늘 따뜻하길');
});

test('타임아웃: AbortController로 중단되면 폴백', async () => {
  const hang = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
  const t0 = Date.now();
  const c = await load(hang, 50);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(c.wishes, null); assert.equal(c.trails, null);
});
