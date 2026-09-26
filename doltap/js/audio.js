// Web Audio: AudioContext 지연 생성·unlock·suspend/resume, master 0.6, 효과음 4종 합성, buzz(ms)
// §5 에셋 표(착지 쿵·낙석 우르르·마일스톤 아르페지오·목탁) + 공통 규칙(attack 5ms → 지수 감쇠 0.001)
const GAIN = 0.6;
let ctx = null, master = null, noise = null, muted = false;

export function state() {
  if (!ctx || ctx.state === 'closed') return 'none';
  return ctx.state === 'running' ? 'running' : 'suspended';
}

function make() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : GAIN;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// 사용자 활성화 이벤트 안에서 호출: 없으면 만들고, 멈춰 있으면 resume
export function unlock() {
  if (!ctx && !make()) return Promise.resolve('none');
  const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
  return p.then(state, state);
}

// pointerup·keydown·click(capture, document)마다 unlock. running이 되면 세 리스너를 제거한다
export function armUnlock(doc) {
  const types = ['pointerup', 'keydown', 'click'];
  const off = () => types.forEach(t => doc.removeEventListener(t, on, true));
  function on() { unlock().then(s => { if (s === 'running') off(); }); }
  types.forEach(t => doc.addEventListener(t, on, true));
}

export function suspend() {
  if (ctx && ctx.state === 'running') return ctx.suspend().catch(() => {});
  return Promise.resolve();
}

export function resume() {
  if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') return ctx.resume().catch(() => {});
  return Promise.resolve();
}

// 반환값: 실제 master gain이 0이면 true(컨텍스트가 없으면 설정값)
export function mute(b) {
  muted = !!b;
  if (master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.value = muted ? 0 : GAIN;
  }
  return master ? master.gain.value === 0 : muted;
}
export const isMuted = () => muted;

function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.005 + dur);
}

function tone(type, f, t, dur, peak) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  env(g, t, peak, dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

function burst(kind, f, t, dur, peak, q = 0) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; fl.type = kind; fl.frequency.value = f;
  if (q) fl.Q.value = q;
  env(g, t, peak, dur);
  s.connect(fl).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.03);
}

const ready = () => ctx && ctx.state === 'running';

// 착지 쿵: 노이즈 80ms → lowpass 900·(34/r)Hz + 110Hz sine 60ms, 퍼펙트 콤보마다 ×2^(combo/12)(최대 +7)
export function thud(r, combo = 0) {
  if (!ready()) return;
  const m = 2 ** (Math.min(Math.max(combo, 0), 7) / 12), t = ctx.currentTime;
  burst('lowpass', 900 * (34 / r) * m, t, 0.08, 0.8);
  tone('sine', 110 * m, t, 0.06, 0.7);
}

// 낙석 우르르: 노이즈 600ms, lowpass 400Hz, 150ms 간격 3겹
export function rumble() {
  if (!ready()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) burst('lowpass', 400, t + i * 0.15, 0.6, 0.5);
}

// 마일스톤: triangle C5-E5-G5-C6, 각 90ms
export function arpeggio() {
  if (!ready()) return;
  const t = ctx.currentTime;
  [523.25, 659.26, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, t + i * 0.09, 0.09, 0.4));
}

// 목탁: sine 520Hz 60ms + bandpass 1.2kHz 노이즈 20ms. 종료음(end)만 780Hz
export function moktak(end = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('sine', end ? 780 : 520, t, 0.06, 0.6);
  burst('bandpass', 1200, t, 0.02, 0.4, 4);
}

export function buzz(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 미지원 */ }
}
