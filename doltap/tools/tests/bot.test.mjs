// bot.test.mjs — 봇 각도 선택(§6 봇 휴리스틱)·30일 통계(§3 검산 9) 순수 함수 (Node 내장 러너)
import { test } from 'node:test';
import assert from 'node:assert/strict';

// physics·judge·core는 window.Matter를 함수 안에서만 읽는다(§6). 혹시 모듈 최상위에서 읽어도 import가 깨지지 않게 둔다
globalThis.window ??= { Matter: {} };
const { chooseAngle, monthStats } = await import('../../js/bot.js');

test('가로 직사각형: 최장 변 동률(0번·2번) → 작은 인덱스 0번(아래 변)이 이미 아래 → 0°', () => {
  assert.equal(chooseAngle({ verts: [[-20, -5], [20, -5], [20, 5], [-20, 5]], cx: 0, cy: 0 }), 0);
});

test('세로 직사각형: 오른쪽 변(1번)을 아래로 → 화면 시계 방향 90°(270°는 변이 위라 1e6 벌점)', () => {
  assert.equal(chooseAngle({ verts: [[-5, -20], [5, -20], [5, 20], [-5, 20]], cx: 0, cy: 0 }), 90);
});

test('무게중심 오프셋: 원점이 아니라 (cx, cy) 기준으로 돌린다', () => {
  const V = [[0, 0], [40, 0], [40, 10], [0, 10]].map(([x, y]) => [x + 100, y + 50]);
  assert.equal(chooseAngle({ verts: V, cx: 120, cy: 55 }), 0);
});

test('monthStats: 29일 띠 안 + 공중 부양 0 → pass', () => {
  const rows = Array.from({ length: 29 }, (_, i) => ({ day: String(i), H: 200 })).concat([{ day: 'x', H: 100 }]);
  const m = monthStats(rows, 0);
  assert.equal(m.inBand, 29);
  assert.ok(Math.abs(m.mean - 5900 / 30) < 1e-9);
  assert.equal(m.pass, true);
});

test('monthStats: 공중 부양 1건이면 fail', () => {
  const rows = Array.from({ length: 30 }, () => ({ H: 200 }));
  assert.equal(monthStats(rows, 1).pass, false);
});

// 합격선 27/30(2026-09-26 사용자 결정: 감쇠·스폰 스윕 최고 inBand 27, §3 검산 9의 29에서 완화)
test('monthStats: 띠 안 27일이면 pass(합격선 27/30)', () => {
  const rows = Array.from({ length: 27 }, () => ({ H: 200 })).concat([{ H: 50 }, { H: 50 }, { H: 50 }]);
  const m = monthStats(rows, 0);
  assert.equal(m.inBand, 27);
  assert.equal(m.pass, true);
});

test('monthStats: 띠 안 26일이면 fail', () => {
  const rows = Array.from({ length: 26 }, () => ({ H: 200 })).concat([{ H: 50 }, { H: 50 }, { H: 50 }, { H: 50 }]);
  const m = monthStats(rows, 0);
  assert.equal(m.inBand, 26);
  assert.equal(m.pass, false);
});
