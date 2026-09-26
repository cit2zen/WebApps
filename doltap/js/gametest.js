// gametest.js — game.js 200줄 분할(레지스트리 E-1 승인): __doltap 훅 지원 + input 조준 정보.
// game.js만 import하고 game.js가 그대로 re-export한다(외부 API는 game.*). 상태는 game.run() 접근자로만 읽는다
import { run, state, dispatch } from './game.js';
import * as scene from './scene.js';
import * as fx from './fx.js';

let last = null;
const sum = a => a.reduce((x, y) => x + y, 0);

// start()가 새 월드마다 호출: W.dropStone을 감싸 낙하 직후 body 꼭짓점(월드 y-up)을 lastDrop용으로 남긴다
export function hookDrop(w) {
  last = null;
  const orig = w.dropStone;
  w.dropStone = function (stone, x, spawnY, aDeg) {
    const b = orig.call(this, stone, x, spawnY, aDeg);
    last = { stone, x, spawnY, aDeg, cx: b.position.x, verts: b.vertices.map(p => [p.x, -p.y]) };
    return b;
  };
}
export const lastDropRaw = () => last;

// ── v4에서 옮긴 조회 훅(본문 동일, 내부 변수는 run()에서) ──
export function view() {
  const { R, set, mode, cam } = run();
  if (!R) return { state: state() };
  return { ...R.view(), state: state(), mode, day: set.day, n: set.n, seed: set.seed, camOff: cam.camOff };
}
export function layout() {
  const { L, cam } = run();
  return L ? { k: L.k, Hv: L.Hv, R: L.R, S: L.S, camOff: cam.camOff, rockScreenY: L.rockScreenY, landscape: L.landscape } : null;
}
export const height = () => run().H;
export const seed = () => (run().set ? run().set.seed : 0);
export function stats() {
  const { W, stepMs, dts } = run(), T = sum(dts);
  return {
    fps: T > 0 ? dts.length / T : 0,
    stepMs: stepMs.length ? sum(stepMs) / stepMs.length : 0,
    drawMs: scene.drawMs(),
    particles: fx.count(),
    caches: scene.caches(),
    bodies: W ? W.stones().length + 1 : 0};
}

// ── 5단계 훅: 가드 없는 조준·낙하·건너뛰기(debug aim·drop·skip). 모두 truthy 객체를 돌려준다 ──
export function aimTo(x, aDeg) {
  if (state() !== 'aim') return { ok: false, reason: state() };
  const { R } = run();
  dispatch({ t: 'setX', x: Math.min(365, Math.max(25, x)) });
  const want = ((Math.round(aDeg / 15) % 24) + 24) % 24;
  let n = (want - Math.round(R.view().aim.aDeg / 15) + 24) % 24;
  while (n-- > 0) dispatch({ t: 'rot', d: 1 });
  const a = R.view().aim;
  return { ok: true, x: a.x, aDeg: a.aDeg };
}
export function dropNow() {
  if (state() !== 'aim') return { ok: false, reason: state() };
  dispatch({ t: 'drop' });
  return { ok: true };
}
export function skipNow() {
  if (state() !== 'aim' || run().R.view().skipUsed) return { ok: false, reason: state() };
  dispatch({ t: 'skip' });
  return { ok: true };
}

// input.js getAim(): aim 중인지, 매달린 돌 x, 화면 매핑 k·ox(camera.layout 결과 L)
export function aimInfo() {
  const { R, L } = run(), on = state() === 'aim';
  return { on, x: on ? R.view().aim.x : 195, k: L ? L.k : 1, ox: L ? L.ox : 0 };
}
