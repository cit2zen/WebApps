// game.js — 앱 컨트롤러: start·step·frame + fx·flags·카메라 + 일시정지·onAction 번역·결과 저장·훅 (§6 game.js)
// core 이벤트 구독(R.on)은 wire.js 한곳, 테스트 훅 지원(view·layout·height·seed·stats·aimTo·dropNow·…)은 gametest.js
import { createWorld } from './physics.js';
import { createRun } from './core.js';
import { todayKST } from './daily.js';
import * as storage from './storage.js';
import { clearTextures } from './render.js';
import * as camera from './camera.js';
import * as scene from './scene.js';
import * as flags from './flags.js';
import * as fx from './fx.js';
import * as hud from './hud.js';
import * as audio from './audio.js';
import { wire } from './wire.js';
import { hookDrop, view } from './gametest.js';
export { view, layout, height, seed, stats, aimTo, dropNow, skipNow, aimInfo, lastDropRaw, summary, setting } from './gametest.js';

const PLAY = ['aim', 'drop', 'settle', 'hold'];
const DROP_GUARD = 150, SKIP_MS = 400;
let screen = 'boot', W = null, R = null, set = null, mode = null, L = null, cam = null;
let H = 0, maxH = 0, skyCm = 0, t = 0, final = false, texSeed = null;
let guides = [], unstable = new Set(), prev = new Map(), ray = null, rayKey = '';
let paused = false, opts = {}, hooks = {}, aimT = -Infinity, tapT = -Infinity, commit = null;   // commit = 공식 판 commitResult 반환값(v6)
let loop = { start() {}, stop() {}, active: () => false }, markAim = () => {};
const stepMs = [], dts = [];
const push = (a, v) => { a.push(v); if (a.length > 60) a.shift(); };

export function init(canvas, o = {}) {                  // o = {loop, markAim}: main 부트에서 1회
  scene.attach(canvas);
  if (o.loop) loop = o.loop;
  if (o.markAim) markAim = o.markAim;
  hud.mount({ onAction }); audio.mute(!storage.load().sound); audio.armUnlock(document);
}
// main의 resize·부트에서 호출: camera.layout(§4 식) 재계산 → 카메라에 새 L 전달 + canvas backing 재설정
export function resize(w, h, safeTop) {
  L = camera.layout(w, h, safeTop);
  if (cam) cam.setLayout(L); else cam = camera.createCamera(L);
  scene.resize(w, h);
  hud.portrait(L.landscape && screen === 'play');      // 가로 화면 오버레이 + 일시정지
  if (L.landscape) pause();
}
export const setHooks = h => { hooks = { ...hooks, ...h }; };
export const hook = (name, ...a) => (hooks[name] ? hooks[name](...a) : undefined);
export const dialogTop = () => hook('dialogTop') || null;
export const hudEl = name => hud.el(name);
export const cancelHint = on => hud.cancelHint(on);
export const audioState = () => audio.state();
// gametest.js 전용 접근자(원시값은 호출 시점 값)
export const run = () => ({ R, W, set, L, cam, mode, H, stepMs, dts, opts, commit });

// 판 정리. 일시정지 중이던 판을 떠나면 멈춘 루프를 다시 돌려 main의 라우팅이 이어지게 한다
function teardown() { if (W) W.destroy(); W = R = set = null; if (paused) { paused = false; loop.start(); } }
export function setScreen(s) { if (s !== 'result') teardown(); screen = s; }
const coreState = () => (R ? R.view().state : null);
export function state() {
  if (screen !== 'play') return screen;
  if (paused) return 'paused';
  const s = coreState();
  return s === 'done' ? 'result' : s;
}
export const running = () => screen === 'play' && !paused && PLAY.includes(coreState());

// friendCm: 유한한 양수만 깃발이 된다(flags가 toFixed를 부른다)
function guidesFor(s, friendCm) {
  const S = storage.load(), g = [];
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

function onHeight(e) {                                  // v4 subscribe()의 height 본문(구독은 wire.js)
  H = e.H;
  cam.setHeight(e.Y);                                   // 목표 camOff = camTarget(L, Y) (§3)
  for (const c of flags.crossed(maxH, H)) flags.popup(c, performance.now());
  maxH = Math.max(maxH, H);
}
// aim 진입(core 이벤트·start 직후): 낙하 가드 기준 시각·건너뛰기 확인 해제·input.markAim
function onAim() { aimT = performance.now(); tapT = -Infinity; hud.skipArm(null); markAim(aimT); }
// core done 1회: 결과 화면 상태 → 공식 판이면 저장 → 훅 result(6단계). 화면 전환은 main의 route
function onDone() {
  screen = 'result';
  const res = R.result();
  commit = mode === 'official' ? storage.commitResult(set.day, res) : null;
  hook('result', { res, mode, day: set.day, set });
}

// m = 'official'|'practice'|'random', s = DailySet(호출자 = debug.pickSet), o.friendCm = 친구 기록(cm)
// 판마다 새 월드(onFirstContact 구독은 해제 불가 → 월드를 재사용하지 않는다)
export function start(m, s, o = {}) {
  teardown();
  if (texSeed !== s.seed) { clearTextures(); texSeed = s.seed; }   // 질감 캐시 키 = seed:i → 세트가 바뀌면 비운다
  const st = storage.load(), friend = Number.isFinite(o.friendCm) ? o.friendCm : null;
  mode = m; set = s; opts = o; commit = null;
  W = createWorld(); hookDrop(W);
  R = createRun(s, { mode: m, W });
  H = 0; maxH = 0; skyCm = 0; t = 0; final = false;
  unstable = new Set(); prev = new Map(); ray = null; rayKey = '';
  fx.clear(); flags.reset();
  guides = guidesFor(s, friend);
  cam.setHeight(0); cam.snap();
  wire(R, { set: s, mode: m, day: s.day, vibe: st.vibe, onAim, onHeight, burst: burstAt, onDone });
  hud.reset({ hand: st.hand, ghost: !st.tutDone, friend, best: st.bestEver || 0 });
  hud.preview(s.stones.slice(1, 3));
  screen = 'play';
  onAim();                                              // core의 첫 aim은 첫 step/dispatch 때 emit → 여기서 먼저 보장
  audio.resume(); loop.start();
  if (L.landscape) { hud.portrait(true); pause(); }     // 가로에서 시작한 판도 오버레이 + 일시정지(§4 k < 0.75)
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

export function dispatch(a) { if (R) R.dispatch(a); return view(); }

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

// 매 rAF(+ dt=0 재그리기: resize·debug step): hud.poll → (play 또는 result 전환 1프레임만) 카메라·하늘·파티클 후 scene.draw
export function frame(dt, now) {
  if (dt > 0) push(dts, dt);
  hud.poll(now);
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

// 일시정지 = loop.stop()(마지막 프레임 유지), 재개 = loop.start()(last=now·acc=0), 가로에서는 재개 거부
export function pause() {
  if (!running()) return state();
  const v = R.view(); paused = true; loop.stop();      // placed = 놓은 돌(건너뛴 1개 제외) · needConfirm = 공식 판 첫 낙하 뒤
  hook('pause', { H: v.H, placed: v.slot - 1 - (v.skipUsed ? 1 : 0), needConfirm: mode === 'official' && !!R.lastDrop() });
  return state();
}
export function resume() {
  if (paused && !(L && L.landscape)) { paused = false; audio.resume(); hook('resume'); loop.start(); }
  return state();
}
export function onHidden() { pause(); audio.suspend(); }       // visible에서 자동 재개 없음
// ── 6단계: S9a 나가기·결과 로비 = 판 폐기(저장 없음, tries 유지). S5/🔊/M 설정(setting)·S10 요약(summary)은 gametest.js ──
export const leave = () => setScreen('lobby');
export function setMute(b) { const r = audio.mute(b); storage.set('sound', !b); hook('sound'); return r; }   // 훅 sound = 🔊 아이콘 동기화

function skipTap(at) {                                  // 400ms 안 2탭 → core skip, 아니면 금색 확인
  if (!R || paused || R.view().state !== 'aim' || R.view().skipUsed) return;
  if (at - tapT < SKIP_MS) { tapT = -Infinity; hud.skipArm(null); dispatch({ t: 'skip' }); }
  else { tapT = at; hud.skipArm(at); }
}
const live = a => { if (R && screen === 'play' && !paused) dispatch(a); };

// keys·input·hud 액션 번역(§6 규칙 4). core에는 core 액션만, drop은 aim 진입 150ms 안이면 버린다(키·포인터 공통, 규칙 8)
export function onAction(a) {
  switch (a.t) {
    case 'pause': return pause();
    case 'resume': return resume();
    case 'mute': return setMute(!audio.isMuted());
    case 'skipTap': return skipTap(a.at ?? performance.now());
    case 'closeTop': case 'today': case 'share': case 'retry': return hook(a.t);
    case 'drop': return performance.now() - aimT < DROP_GUARD ? undefined : live(a);
    case 'move': case 'setX': case 'rot': case 'cancel': return live(a);
    default: return undefined;
  }
}
