import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, camTarget, createCamera } from '../../js/camera.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('390×844(safe 0): k 1, R 694, S 211, 바위 694, 세로', () => {
  const L = layout(390, 844, 0);
  assert.equal(L.k, 1); assert.equal(L.Hv, 844); assert.equal(L.R, 694);
  assert.equal(L.S, 211); assert.equal(L.rockScreenY, 694); assert.equal(L.ox, 0);
  assert.equal(L.landscape, false);
});

test('844 기준 카메라 목표 = max(0, Y − 303)', () => {
  const L = layout(390, 844, 0);
  assert.equal(camTarget(L, 0), 0);
  assert.equal(camTarget(L, 303), 0);
  near(camTarget(L, 400), 97);
  const L47 = layout(390, 844, 47);          // safeTop 47에서도 S = 211, 목표식 동일
  assert.equal(L47.S, 211);
  near(camTarget(L47, 400), 97);
});

test('360×640: k 0.923, S 160 / 390×664: k 1, S 166', () => {
  const A = layout(360, 640, 0);
  near(A.k, 360 / 390); near(A.Hv, 693.33, 0.01); assert.equal(A.S, 160);
  const B = layout(390, 664, 0);
  assert.equal(B.k, 1); assert.equal(B.S, 166);
});

test('1366×650 데스크톱: k 1.5 상한, S 192.25, 좌우 여백', () => {
  const L = layout(1366, 650, 0);
  assert.equal(L.k, 1.5); near(L.S, 192.25); near(L.ox, (1366 - 585) / 2);
});

test('844×390 가로 폰: k 0.564 < 0.75 → landscape', () => {
  const L = layout(844, 390, 0);
  near(L.k, 134 / 237.5); assert.equal(L.landscape, true);
});

test('toScreen/toWorld: 바위 윗면 중앙 (195,0) → (195,694), 첫 스폰 y 514', () => {
  const cam = createCamera(layout(390, 844, 0));
  assert.deepEqual(cam.toScreen(195, 0), [195, 694]);
  assert.deepEqual(cam.toScreen(195, 180), [195, 514]);
  const [x, y] = cam.toWorld(100, 400);
  const [sx, sy] = cam.toScreen(x, y);
  near(sx, 100); near(sy, 400);
});

test('추적: 반감기 ln2/4 s, 목표로 수렴하고 0 아래로 가지 않음', () => {
  const cam = createCamera(layout(390, 844, 0));
  cam.setHeight(403);                        // 목표 100
  assert.equal(cam.target, 100);
  cam.track(Math.LN2 / 4);
  near(cam.camOff, 50);
  for (let i = 0; i < 200; i++) cam.track(1 / 60);
  near(cam.camOff, 100, 0.01);
  cam.setHeight(0);                          // 탑이 낮아지면 목표 0
  for (let i = 0; i < 600; i++) cam.track(1 / 60);
  assert.ok(cam.camOff >= 0 && cam.camOff < 0.01);
  cam.setHeight(403); assert.equal(cam.snap(), 100);
  cam.setLayout(layout(390, 664, 0));        // 목표 재계산: 403 − (514 − 180 − 166) = 235
  near(cam.target, 235);
});
