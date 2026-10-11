// 배경 음악 — WebAudio 절차 생성, rAF 스케줄러 (events.js 구독)
import { $ } from './dom.js';
import { on } from './events.js';
import { store } from './storage.js';
import { getCtx, soundOn } from './audio.js';
import { MENU, PLAY, JINGLE, midi, hz } from './music-tracks.js';
import { voice, drum } from './music-synth.js';

const MASTER = 0.06;
const LOOKAHEAD = 0.15;
const FADE = 0.45;
const TRACKS = { menu: MENU, play: PLAY };

let master = null; // 음악 전용 GainNode
let cur = null; // { name, def, gain, step, next }
let raf = 0;
let want = null; // 지금 화면에 맞는 곡
let musicOn = store.get('music', true) !== false;
const pauses = new Set();
let fever = false;
let rush = false;
const hotNow = () => fever || rush; // 피버·러시

function graph() {
  const ctx = getCtx();
  if (!ctx) return null;
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  return ctx;
}

const audible = () => musicOn && soundOn() && !document.hidden;

function setLevel() {
  const ctx = graph();
  if (!ctx) return;
  const duck = pauses.has('sheet') || pauses.has('bonus') ? 0.4 : 1;
  const v = audible() ? MASTER * duck : 0;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.12);
}

/** 한 칸(16분음표) 예약 */
function scheduleStep(ctx, tr, t) {
  const { def } = tr;
  const sd = 60 / def.bpm / 4;
  const bar = Math.floor(tr.step / 16) % def.roots.length;
  const st = tr.step % 16;
  const isHot = hotNow() && tr.name === 'play';
  // 베이스 — 메뉴는 1·3박, 플레이는 8분음표 옥타브 왕복
  const root = def.roots[bar];
  if (tr.name === 'menu' ? st % 8 === 0 : st % 2 === 0) {
    const n = tr.name === 'play' && st % 4 === 2 ? root + 12 : root;
    voice(ctx, tr.gain, t, hz(n), sd * (tr.name === 'menu' ? 7 : 1.8), 'triangle', def.bassVol);
  }
  for (const [s, n, len] of def.lead[bar]) {
    if (s !== st) continue;
    voice(ctx, tr.gain, t, hz(isHot ? n + 12 : n), sd * len * 0.9, def.wave, def.leadVol * (isHot ? 0.8 : 1));
  }
  const pat = def.drums[st];
  if (pat !== '.') drum(ctx, tr.gain, t, pat);
  if (isHot && def.hot && pat !== 'h') drum(ctx, tr.gain, t, 'h');
  tr.step++;
  tr.next += sd;
}

function tick() {
  raf = 0;
  const ctx = getCtx();
  if (!ctx || !cur) return;
  if (cur.next < ctx.currentTime - 0.2) cur.next = ctx.currentTime + 0.05; // 오래 멈췄다면 건너뜀
  try {
    while (cur.next < ctx.currentTime + LOOKAHEAD) scheduleStep(ctx, cur, cur.next);
  } catch { /* 예약 실패는 무시 */ }
  raf = requestAnimationFrame(tick);
}

function fadeOut(tr) {
  const ctx = getCtx();
  if (!tr || !ctx) return;
  tr.gain.gain.cancelScheduledValues(ctx.currentTime);
  tr.gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 3);
  setTimeout(() => { try { tr.gain.disconnect(); } catch { /* 이미 끊김 */ } }, FADE * 1000 + 400);
}

function start(name) {
  const ctx = graph();
  if (!ctx) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE);
  gain.connect(master);
  cur = { name, def: TRACKS[name], gain, step: 0, next: ctx.currentTime + 0.08 };
  if (!raf) raf = requestAnimationFrame(tick);
}

/** 원하는 곡과 실제 재생을 맞춤 */
function sync() {
  const ctx = graph();
  if (!ctx) return;
  const target = audible() && !pauses.has('menu') ? want : null;
  if (target && ctx.state === 'suspended') ctx.resume().catch(() => {});
  setLevel();
  if ((cur && cur.name) === target) return;
  if (cur) { fadeOut(cur); cur = null; }
  if (target) start(target);
}

function jingle(kind) {
  const ctx = graph();
  if (!ctx || !audible()) return;
  const { bpm, notes } = JINGLE[kind];
  const beat = 60 / bpm;
  const t0 = ctx.currentTime + 0.1;
  for (const [b, n, len] of notes) voice(ctx, master, t0 + b * beat, hz(midi(n)), len * beat, 'triangle', 0.5);
}

/* 🎵 토글 버튼 */
function renderBtn() {
  const btn = $('#btn-music');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(musicOn));
  btn.setAttribute('aria-label', musicOn ? '음악 켜짐' : '음악 꺼짐');
  btn.classList.toggle('is-off', !musicOn);
}
$('#btn-music')?.addEventListener('click', () => {
  musicOn = !musicOn;
  store.set('music', musicOn);
  renderBtn();
  sync();
});
renderBtn();

/* 이벤트 */
let lastRun = null;
on('audio:unlock', sync);
on('audio:sound', sync);
on('run:end', (r) => { lastRun = r; });
on('screen', ({ name }) => {
  pauses.clear();
  fever = rush = false;
  if (name === 'play') want = 'play';
  else if (name === 'result') {
    want = null;
    sync();
    jingle(lastRun && (lastRun.success || lastRun.endless || lastRun.mode === 'review' || lastRun.mode === 'daily') ? 'success' : 'fail');
    return;
  } else want = 'menu';
  sync();
});
on('pause', ({ why }) => { pauses.add(why); sync(); });
on('unpause', ({ why }) => { pauses.delete(why); sync(); });
on('fever', ({ on: v }) => { fever = !!v; });
on('rush', ({ on: v }) => { rush = !!v; });
on('run:start', () => { fever = rush = false; });
document.addEventListener('visibilitychange', sync);
