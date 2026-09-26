import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, rotCW, COS, SIN, hull, widthRatio, area2, centroid, dsin, dcos, toneOf } from '../../js/stones.js';
import { fnv } from '../../js/rng.js';

const G = generate(fnv('20261001'), '20261001', 1);
const ABBR = { flat: 'F', angular: 'A', round: 'R', wedge: 'W' };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const dayOf = k => new Date(Date.UTC(2026, 9, 1 + k)).toISOString().slice(0, 10).replaceAll('-', '');
const rw = t => t === 'round' || t === 'wedge';

test('실례 1 헤더: seed·pattern·rScale·wishIdx·trailIdx', () => {
  assert.equal(G.seed, 1568161157);
  assert.equal(G.pattern, 'FAF');
  assert.ok(near(G.rScale, 0.9878333975528653));
  assert.equal(G.wishIdx, 24);
  assert.equal(G.trailIdx, 0);
  assert.equal(G.stones.length, 24);
});

test('실례 1 유형열 FAFFARRFAAFAAWRAAWWAWAWR', () => {
  assert.equal(G.stones.map(s => ABBR[s.type]).join(''), 'FAFFARRFAAFAAWRAAWWAWAWR');
});

test('실례 1 area 중앙값 2111.95', () => {
  const A = G.stones.map(s => s.area).sort((a, b) => a - b);
  assert.equal((A[11] + A[12]) / 2, 2111.95);
});

test('실례 1 슬롯 1 Stone 골든', () => {
  const s = G.stones[0];
  assert.equal(s.i, 1); assert.equal(s.type, 'flat'); assert.equal(s.band, 'A');
  assert.ok(near(s.r0, 38.56796620134264));
  assert.ok(near(s.r, 38.09872508937638));
  assert.ok(near(s.s, 0.6031809794064611));
  assert.equal(s.n, 8);
  assert.deepEqual(s.verts, [[-37.13, -3.62], [-33.85, -14.43], [-2.84, -24.17], [23.14, -16.01],
    [35.53, -4.25], [22.22, 19.81], [-2.08, 22.84], [-30.63, 17.11]]);
  assert.equal(s.cx, -2.2); assert.equal(s.cy, 0.07);
  assert.equal(s.area, 2511.4);
  assert.equal(s.tone, 'stone-ochre-d'); assert.equal(s.moss, 0); assert.equal(s.attempts, 1);
});

test('규칙 3: 같은 유형 3연속 0 · 둥근/쐐기 3연속 0 · 첫 돌 납작 (30일)', () => {
  for (let k = 0; k < 30; k++) {
    const d = dayOf(k);
    const T = generate(fnv(d), d, k + 1).stones.map(s => s.type);
    assert.equal(T[0], 'flat');
    for (let i = 2; i < 24; i++) {
      assert.ok(!(T[i] === T[i - 1] && T[i] === T[i - 2]), d + ' 슬롯 ' + (i + 1) + ' 같은 유형 3연속');
      assert.ok(!(rw(T[i]) && rw(T[i - 1]) && rw(T[i - 2])), d + ' 슬롯 ' + (i + 1) + ' 둥근/쐐기 3연속');
    }
  }
});

test('r·s 범위, 폭 비율 ≥ 0.3, 면적 양수(반시계)', () => {
  for (const s of G.stones) {
    assert.ok(s.r >= 22 && s.r <= 46);
    assert.ok(s.s >= 0.45 && s.s <= 1.0);
    assert.ok(Math.floor(widthRatio(s.verts) * 1000) >= 300 || s.attempts === 21);
    assert.ok(area2(s.verts) > 0);
  }
});

test('COS/SIN 상수표와 rotCW(월드 y-up, 화면 시계 방향 +)', () => {
  assert.equal(COS.length, 24); assert.equal(SIN[0], 0); assert.equal(SIN[6], 1);
  assert.deepEqual(rotCW([1, 0], 0), [1, 0]);
  assert.deepEqual(rotCW([1, 0], 6), [0, -1]);   // 90° 시계: +x → −y
  assert.deepEqual(rotCW([0, 1], 6), [1, 0]);    // +y → +x
});

test('dsin/dcos 테일러: |θ|≤π에서 반지름 오차 2.5% 미만', () => {
  for (let t = -Math.PI; t <= Math.PI; t += 0.01) {
    assert.ok(Math.abs(Math.hypot(dsin(t), dcos(t)) - 1) < 0.025);
  }
});

test('hull: 공선점 제거, 최소 x·y 시작 반시계 / centroid', () => {
  assert.deepEqual(hull([[0, 0], [2, 0], [1, 0], [2, 2], [0, 2]]), [[0, 0], [2, 0], [2, 2], [0, 2]]);
  assert.deepEqual(centroid([[0, 0], [2, 0], [2, 2], [0, 2]]), [1, 1]);
});

test('n=0(랜덤) trailIdx는 별도 스트림 0~29, n<0은 양의 나머지', () => {
  const r = generate(12345, '20261001', 0);
  assert.ok(r.trailIdx >= 0 && r.trailIdx < 30);
  assert.equal(generate(fnv('20260920'), '20260920', -10).trailIdx, 19);
});

test('toneOf 매핑(§6 정합 #1)', () => {
  assert.equal(toneOf('stone-gray-l'), '--doltap-stone-gray');
  assert.equal(toneOf('stone-ochre-d'), '--doltap-stone-ochre-dk');
  assert.equal(toneOf('stone-slate-d'), '--doltap-stone-slate-dk');
});
