// audio.js — Web Audio 합성(외부 음원 0개): push/pop/blocked/clear/shutter 5종 + 5음계 표 10 + vibrate.
// AudioContext는 첫 unlock()에서 지연 생성. unlock은 once가 아니라 제스처마다 재시도하고,
// ctx.state === 'running'이 되면 document pointerdown·keydown 리스너(= unlock 함수 자체)를 제거한다.
const TONES = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];   // C4 … A5
const ARP = [523.25, 659.25, 783.99, 1046.50];     // 클리어 아르페지오 C5·E5·G5·C6, 각 87ms
const GAIN = { push: 0.25, pop: 0.20, arp: 0.25, blocked: 0.30, shutter: 0.40 };
const ATK = 0.005, REL = 0.020;                    // 엔벨로프 attack 5ms · release 20ms
const set = { sound: true, vibrate: true };
let ctx = null, master = null, noise = null, attempts = 0;

export function tones() { return TONES.slice(); }

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = set.sound ? 1 : 0; master.connect(ctx.destination);
  } catch (e) { ctx = null; master = null; }
  return ctx;
}
function detach() {
  if (typeof document === 'undefined') return;
  for (const t of ['pointerdown', 'keydown']) {
    document.removeEventListener(t, unlock); document.removeEventListener(t, unlock, true);
  }
}
// main.js 부팅 ⑦: document.addEventListener('pointerdown', audio.unlock) · ('keydown', audio.unlock) — once 아님.
export function unlock() {
  attempts++;
  const c = ensure(); if (!c) return;
  if (c.state === 'running') { detach(); return; }
  try {
    const p = c.resume();
    if (p && typeof p.then === 'function') p.then(() => { if (c.state === 'running') detach(); }, () => {});
  } catch (e) { /* suspended 잔류 → 다음 제스처에서 재시도 */ }
}
export function installUnlock() {                  // 선택: main 대신 리스너 2개 등록
  if (typeof document === 'undefined') return;
  document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
}
// __hanbut.audio() 용
export function status() {
  return { state: ctx ? ctx.state : 'none', sound: set.sound, vibrate: set.vibrate, unlockAttempts: attempts };
}
export const info = status;

// 설정(hanbut:settings {sound, vibrate}) — 마스터 게인 1/0 · navigator.vibrate 호출 여부
export function setSound(on) {
  set.sound = !!on;
  if (master) { try { master.gain.setValueAtTime(set.sound ? 1 : 0, ctx.currentTime); } catch (e) { master.gain.value = set.sound ? 1 : 0; } }
}
export function setVibrate(on) { set.vibrate = !!on; }
export const applySettings = s => setSettings(s);
export function setSettings(s) {
  if (!s) return;
  if (typeof s.sound === 'boolean') setSound(s.sound);
  if (typeof s.vibrate === 'boolean') setVibrate(s.vibrate);
}
export function vibrate(pattern) {                 // iOS(미지원)는 무시
  if (!set.vibrate || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
}

// ── 합성 헬퍼 ──
function live() { return ctx && master && ctx.state === 'running' && set.sound; }
function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + ATK);
  g.gain.setValueAtTime(peak, t + Math.max(ATK, dur - REL));
  g.gain.linearRampToValueAtTime(0, t + dur);
}
function tone(freq, t, dur, peak) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
  env(g, t, peak, dur); o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.01);
}
function burst(t, dur, peak, lowpass) {           // 화이트 노이즈(0.2s 버퍼 1회 생성 재사용)
  if (!noise) {
    const len = Math.floor(ctx.sampleRate * 0.2);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = noise;
  let out = s;
  if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lowpass, t); s.connect(f); out = f; }
  env(g, t, peak, dur); out.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.01);
}
const clampIdx = i => Math.max(0, Math.min(9, i | 0));
// push 음 idx = floor(9·(len−1)/(n−1)). 인자: 이벤트 payload {idx} 또는 {len}+n, 또는 idx 숫자.
function toneIdx(p, n) {
  if (typeof p === 'number') return clampIdx(p);
  if (p && n > 1 && typeof p.len === 'number') return clampIdx(Math.floor(9 * (p.len - 1) / (n - 1)));
  return clampIdx(p && typeof p.idx === 'number' ? p.idx : 0);
}

// ── 합성 5종 ──
export function push(p, n) {                       // 사인 80ms, 게인 0.25 + 진동 10
  vibrate(10);
  if (live()) tone(TONES[toneIdx(p, n)], ctx.currentTime, 0.08, GAIN.push);
}
export function pop(p, n) {                        // pop된 칸 음 ÷ 2, 사인 60ms, 게인 0.20, 진동 없음
  if (live()) tone(TONES[toneIdx(p, n)] / 2, ctx.currentTime, 0.06, GAIN.pop);
}
export function blocked() {                        // 막힘: 노이즈 → 로패스 200Hz 100ms, 게인 0.3 + 진동 30
  vibrate(30);
  if (live()) burst(ctx.currentTime, 0.1, GAIN.blocked, 200);
}
export function clear() {                          // 아르페지오 4음 × 87ms(합 348ms) + 진동 [20,40,60]
  vibrate([20, 40, 60]);
  if (!live()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < ARP.length; i++) tone(ARP[i], t + i * 0.087, 0.087, GAIN.arp);
}
export function shutter() {                        // 찰칵: 노이즈 버스트 30ms, 게인 0.4(팩 완료 850ms 시점)
  if (live()) burst(ctx.currentTime, 0.03, GAIN.shutter, 0);
}

// 이벤트명 배선 호환: push · pop · deadend · clear · packShutter
export function handle(name, p) {
  switch (name) {
    case 'push': push(p); break;
    case 'pop': pop(p); break;
    case 'deadend': blocked(); break;
    case 'clear': clear(); break;
    case 'packShutter': shutter(); break;
    default: return null;
  }
  return true;
}
