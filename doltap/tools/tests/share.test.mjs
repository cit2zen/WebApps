// share.test.mjs — 규칙 19 공유 텍스트·shareFlow 경로 (Node 내장 러너)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, shareFlow, gridRows, SHARE_URL } from '../../js/share.js';

const RUN = { day: '20261001', n: 1, mode: 'official', try: 2, Y: 297.0, H: 148.5, c: 1485,
  left: 19, perfect: 4, fell: 3, skipped: false, grid: 'SPSSPSXSSSPSSSXSSPSSSXEE' };   // §5 실례 2
const SET = { day: '20261001', n: 1, seed: 1568161157 };
const abort = () => { const e = new Error('취소'); e.name = 'AbortError'; return e; };

test('실례 2 → 공유 텍스트 7행이 §5 원문과 같다', () => {
  const want = ['돌탑 #1 🪨 148.5cm (19/24)', '🟫🟨🟫🟫🟨🟫', '💥🟫🟫🟫🟨🟫', '🟫🟫💥🟫🟫🟨', '🟫🟫🟫💥⬜⬜',
    '🔥연속 1일 · 도전 2/3', 'https://games.cityzen.kr/doltap/?d=20261001&c=1485'].join('\n');
  assert.equal(buildShareText({ run: RUN, set: SET, mode: 'official', streak: 1, tries: 2 }), want);
});

test('과거 날짜 연습: 1행 연습 머리말, 6행 없음, 7행 ?d=그 날짜', () => {
  const t = buildShareText({ run: RUN, set: { day: '20260930', n: 0 }, mode: 'practice' }).split('\n');
  assert.equal(t.length, 6);
  assert.equal(t[0], '돌탑 연습 🪨 148.5cm (19/24)');
  assert.equal(t[5], 'https://games.cityzen.kr/doltap/?d=20260930&c=1485');
});

test('랜덤 연습: 마지막 행은 파라미터 없는 URL', () => {
  const t = buildShareText({ run: RUN, set: { day: '20261001', n: 0 }, mode: 'random' }).split('\n');
  assert.equal(t.length, 6);
  assert.equal(t[5], SHARE_URL);
});

test('c가 없으면 round(H×10)을 쓴다', () => {
  const run = { ...RUN, c: undefined, H: 23.5 };
  assert.match(buildShareText({ run, set: SET, mode: 'official' }), /\?d=20261001&c=235$/);
});

test('숫자가 아닌 day는 URL에 넣지 않는다(파라미터 없는 URL)', () => {
  const t = buildShareText({ run: RUN, set: { day: '2026<x>01', n: 1 }, mode: 'practice' }).split('\n');
  assert.equal(t[t.length - 1], SHARE_URL);
});

test('gridRows: 짧은 grid는 ⬜로 채워 4행 × 6칸', () => {
  const rows = gridRows('PSX');
  assert.equal(rows.length, 4);
  assert.equal(rows[0], '🟨🟫💥⬜⬜⬜');
  assert.equal(rows[3], '⬜⬜⬜⬜⬜⬜');
});

test('shareFlow: navigator.share 성공 → native', async () => {
  assert.equal(await shareFlow('x', { nav: { share: async () => {} } }), 'native');
});

test('shareFlow: 공유 시트 취소(AbortError) → cancel, 클립보드로 넘어가지 않는다', async () => {
  let copied = 0;
  const nav = { share: async () => { throw abort(); }, clipboard: { writeText: async () => { copied++; } } };
  assert.equal(await shareFlow('x', { nav }), 'cancel');
  assert.equal(copied, 0);
});

test('shareFlow: share 실패 → clipboard', async () => {
  const nav = { share: async () => { throw new Error('NotAllowed'); }, clipboard: { writeText: async () => {} } };
  assert.equal(await shareFlow('x', { nav }), 'clipboard');
});

test('shareFlow: share 없음 + clipboard 거부 → fallback', async () => {
  const nav = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
  assert.equal(await shareFlow('x', { nav }), 'fallback');
});

test("shareFlow: force 'fallback'은 share·clipboard를 부르지 않는다", async () => {
  let called = 0;
  const nav = { share: async () => { called++; }, clipboard: { writeText: async () => { called++; } } };
  assert.equal(await shareFlow('x', { nav, force: 'fallback' }), 'fallback');
  assert.equal(called, 0);
});

test("shareFlow: force 'clipboard'는 share를 건너뛴다", async () => {
  let shared = 0;
  const nav = { share: async () => { shared++; }, clipboard: { writeText: async () => {} } };
  assert.equal(await shareFlow('x', { nav, force: 'clipboard' }), 'clipboard');
  assert.equal(shared, 0);
});
