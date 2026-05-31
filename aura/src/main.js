import { initSettings, hasKey } from './settings.js';
import { MicAudio } from './audio.js';
import { Speech } from './speech.js';
import { Claude } from './claude.js';
import { TTS } from './tts.js';
import { Visualizer } from './visualizer.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const captionEl = document.getElementById('caption');
const orb = document.getElementById('orb');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

const mic = new MicAudio();
const speech = new Speech();
const claude = new Claude();
const tts = new TTS();
const viz = new Visualizer(ctx);
const settings = initSettings(updateReady);

viz.resize(innerWidth, innerHeight);
addEventListener('resize', () => viz.resize(innerWidth, innerHeight));

let phase = 'idle';
let running = false;

function setPhase(p) {
  phase = p;
  viz.setPhase(p);
  document.body.dataset.phase = p;
  const labels = { idle: '대기', listening: '듣는 중…', thinking: '생각 중…', speaking: '말하는 중…' };
  statusEl.textContent = labels[p] || '';
}

// 자막을 블러-인 애니메이션과 함께 교체.
function setCaption(text) {
  captionEl.classList.remove('show');
  void captionEl.offsetWidth;
  captionEl.textContent = text;
  captionEl.classList.add('show');
}

function updateReady() {
  if (!running) {
    statusEl.textContent = hasKey() ? '준비됨 — 시작을 누르세요' : '⚙ 설정에서 API 키를 입력하세요';
  }
}

// 오디오 소스 라우팅: listening=마이크, speaking=TTS 엔벨로프, 그 외=무음
viz.setSource(() => {
  if (phase === 'listening') { mic.sample(); return { level: mic.getLevel(), spectrum: mic.getSpectrum() }; }
  if (phase === 'speaking') return tts.getEnvelope();
  return { level: 0, spectrum: null };
});

async function startConversation() {
  if (!hasKey()) { settings.open(); return; }
  if (!speech.supported) { statusEl.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome 권장)'; return; }
  try { await mic.start(); }
  catch { statusEl.textContent = '마이크 권한이 필요합니다'; return; }
  running = true;
  document.body.dataset.running = 'true';
  orb.classList.add('active');
  listen();
}

function stopConversation() {
  running = false;
  document.body.dataset.running = 'false';
  orb.classList.remove('active');
  speech.stop();
  tts.cancel();
  mic.stop();
  setPhase('idle');
  updateReady();
}

function listen() {
  if (!running) return;
  setPhase('listening');
  captionEl.textContent = '';
  speech.onInterim = (t) => { captionEl.textContent = t; };
  // 'error' 뒤엔 항상 'end'가 따라오므로 재시작은 onEnd에만 맡긴다(중복 start 방지).
  // 치명적 권한 오류만 여기서 중단 처리.
  speech.onError = (err) => {
    if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
      statusEl.textContent = '마이크/음성 인식 권한을 허용해 주세요';
      stopConversation();
    }
  };
  speech.onEnd = async (text) => {
    if (!running) return;
    if (!text) { setTimeout(listen, 200); return; } // 무발화 → 다시 듣기
    setCaption('"' + text + '"');
    await respond(text);
  };
  speech.start();
}

async function respond(userText) {
  setPhase('thinking');
  let reply;
  try { reply = await claude.send(userText); }
  catch (e) {
    setPhase('idle');
    statusEl.textContent = String(e.message).startsWith('NO_KEY')
      ? '⚙ API 키를 확인하세요' : '응답 오류: ' + e.message;
    if (running) setTimeout(listen, 1200);
    return;
  }
  setCaption(reply);
  setPhase('speaking');
  await tts.speak(reply);
  if (running) listen();
}

orb.addEventListener('click', () => (running ? stopConversation() : startConversation()));
updateReady();

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  tts.update(dt);
  viz.render(dt, innerWidth, innerHeight);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
