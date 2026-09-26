// game.js — 앱 컨트롤러 4단계 최소판: start·step·frame + fx·flags·카메라 배선 (hud·audio·input·저장은 5단계)
import { createWorld } from './physics.js';
import { createRun } from './core.js';
import { todayKST } from './daily.js';
import { load } from './storage.js';
import { clearTextures } from './render.js';
import * as camera from './camera.js';
import * as scene from './scene.js';
import * as flags from './flags.js';
import * as fx from './fx.js';

const PLAY = ['aim', 'drop', 'settle', 'hold'];
let screen = 'boot', W = null, R = null, set = null, mode = null, L = null, cam = null;
let H = 0, maxH = 0, skyCm = 0, t = 0, final = false;
let guides = [], unstable = new Set(), prev = new Map(), ray = null, rayKey = '';
const stepMs = [], dts = [];
const push = (a, v) => { a.push(v); if (a.length > 60) a.shift(); };
const sum = a => a.reduce((x, y) => x + y, 0);

export function init(canvas) { scene.attach(canvas); }
// main의 resize·부트에서 호출: camera.layout(§4 식) 재계산 → 카메라에 새 L 전달 + canvas backing 재설정
export function resize(w, h, safeTop) {
  L = camera.layout(w, h, safeTop);
  if (cam) cam.setLayout(L); else cam = camera.createCamera(L);
  scene.resize(w, h);
}
export function setScreen(s) { screen = s; }
const coreState = () => (R ? R.view().state : null);
export function state() {
  if (screen !== 'play') return screen;
  const s = coreState();
  return s === 'done' ? 'result' : s;
}
export const running = () => screen === 'play' && PLAY.includes(coreState());

// friendCm: 유한한 양수만 깃발이 된다(flags가 toFixed를 부른다)
function guidesFor(s, friendCm) {
  const S = load(), g = [];
  if (S.bestEver > 0) g.push({ kind: 'best', cm: S.bestEver });
  const d = s.day === todayKST() && S.days && S.days[s.day];
  if (d && d.best && d.best.H > 0) g.push({ kind: 'today', cm: d.best.H });
  if (Number.isFinite(friendCm) && friendCm > 0) g.push({ kind: 'friend', cm: friendCm });
  return g;
}

// slot = land/perfect 페이로드의 1-based Stone.i (페이로드에 body는 없다 → view().bodies에서 찾는다)
function burstAt(kind, slot) {
  const b = (R.view().bodies || []).find(q => q.i === slot), s = b && set.stones[b.i - 1];
  if (!s) return;
  fx.burst(kind, b.x, kind === 'dust' ? b.y - s.r * s.s : b.y + s.r * s.s * 0.5);
}

// core 이벤트 구독은 여기 한곳뿐. 5단계(T5b)가 이 블록을 통째로 wire.js로 옮긴다(레지스트리 E-1)
function subscribe(run) {
  run.on('height', e => {
    H = e.H;
    cam.setHeight(e.Y);                                   // 목표 camOff = camTarget(L, Y) (§3)
    for (const c of flags.crossed(maxH, H)) flags.popup(c, performance.now());
    maxH = Math.max(maxH, H);
  });
  run.on('land', p => burstAt('dust', p.slot));
  run.on('perfect', p => burstAt('gold', p.slot));
  run.on('done', () => { screen = 'result'; });
}

// m = 'official'|'practice'|'random', s = DailySet(호출자 = debug.pickSet), opts.friendCm = 친구 기록(cm)
// 판마다 새 월드(onFirstContact 구독은 해제 불가 → 월드를 재사용하지 않는다)
export function start(m, s, opts = {}) {
  if (W) W.destroy();
  if (!set || set.seed !== s.seed) clearTextures();      // 질감 캐시 키 = seed:i → 세트가 바뀌면 비운다
  mode = m; set = s;
  W = createWorld();
  R = createRun(s, { mode: m, W });
  H = 0; maxH = 0; skyCm = 0; t = 0; final = false;
  unstable = new Set(); prev = new Map(); ray = null; rayKey = '';
  fx.clear();
  flags.reset();
  guides = guidesFor(s, opts.friendCm ?? null);
  cam.setHeight(0);
  cam.snap();
  subscribe(R);
  screen = 'play';
  return s;
}

export function step() {
  if (!R) return;
  const t0 = performance.now();
  R.step();
  push(stepMs, performance.now() - t0);
  const v = R.view(), next = new Map(), un = new Set();
  for (const b of v.bodies || []) {
    const p = prev.get(b.i);
    if (p && (Math.hypot(b.x - p.x, b.y - p.y) >= 0.15 || Math.abs(b.angle - p.a) >= 0.01)) un.add(b.i);
    next.set(b.i, { x: b.x, y: b.y, a: b.angle });
  }
  prev = next; unstable = un;
}

export function dispatch(a) {
  if (R) R.dispatch(a);
  return view();
}

function updateRay(v) {
  const s = set.stones[v.slot - 1];
  if (!s || !v.aim) { ray = null; return; }
  const key = `${v.slot}:${v.aim.x}:${v.aim.aDeg}:${(v.bodies || []).length}:${v.fell}`;
  if (key === rayKey) return;
  rayKey = key;
  ray = W.rayDown(v.aim.x + scene.lowPoint(s, v.aim.aDeg)[0]);
}

// 투영 P: ox·base·w·h는 camera.layout 결과 L, camOff는 camera.js의 cam.camOff
const proj = () => ({ k: L.k, ox: L.ox, base: L.rockScreenY, camOff: cam.camOff, Hv: L.Hv, w: L.w, h: L.h });

// 매 rAF: fps 표본 → (play 또는 result 전환 1프레임만) 카메라·하늘·파티클 갱신 후 scene.draw
export function frame(dt, now) {
  if (dt > 0) push(dts, dt);
  if (!R || !L) return;
  if (screen !== 'play' && !(screen === 'result' && !final)) return;
  if (screen === 'result') final = true;
  t += dt;
  cam.track(dt);                                                    // camera.js: 반감기 0.17s 추적
  skyCm += (H - skyCm) * (1 - Math.exp(-1.4 * dt));                 // 하늘 0.5s 반감기
  fx.update(dt);
  const v = R.view();
  if (v.state === 'aim') updateRay(v); else ray = null;
  scene.draw({ Q: proj(), seed: set.seed, set, view: v, skyCm, t, now, unstable, ray, maxH, guides });
}

export function view() {
  if (!R) return { state: state() };
  return { ...R.view(), state: state(), mode, day: set.day, n: set.n, seed: set.seed, camOff: cam.camOff };
}
export const layout = () =>
  (L ? { k: L.k, Hv: L.Hv, R: L.R, S: L.S, camOff: cam.camOff, rockScreenY: L.rockScreenY, landscape: L.landscape } : null);
export const height = () => H;
export const seed = () => (set ? set.seed : 0);
export function stats() {
  const T = sum(dts);
  return {
    fps: T > 0 ? dts.length / T : 0,
    stepMs: stepMs.length ? sum(stepMs) / stepMs.length : 0,
    drawMs: scene.drawMs(),
    particles: fx.count(),
    caches: scene.caches(),
    bodies: W ? W.stones().length + 1 : 0};
}
