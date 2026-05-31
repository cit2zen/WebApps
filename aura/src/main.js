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

viz.resize(innerWidth, innerHeight);
addEventListener('resize', () => viz.resize(innerWidth, innerHeight));

let phase = 'idle';
let running = false;
let emptyTurns = 0;         // 연속 무발화 횟수(유휴 자동 종료용)

// 모션 민감/저사양: CSS 애니메이션만이 아니라 캔버스 렌더 루프도 완화한다.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setPhase(p) {
  phase = p;
  viz.setPhase(p);
  document.body.dataset.phase = p;
  const labels = { idle: '대기', listening: '듣는 중…', thinking: '생각 중…', speaking: '말하는 중…' };
  statusEl.textContent = labels[p] || '';
  // 모션 민감 모드는 RAF가 멈춰 있으므로 페이즈 색만 1프레임 갱신.
  if (reduceMotion.matches && !document.hidden) renderStaticFrame();
}

// 자막을 블러-인 애니메이션과 함께 교체.
function setCaption(text) {
  captionEl.classList.remove('show');
  void captionEl.offsetWidth;
  captionEl.textContent = text;
  captionEl.classList.add('show');
}

function updateReady() {
  if (!running) statusEl.textContent = '준비됨 — 시작을 누르세요';
}

// 모바일 Safari 등은 사용자 제스처 밖 speechSynthesis가 무음일 수 있어
// 첫 클릭에서 빈 utterance로 워밍업한다. (서버 TTS 성공 시엔 영향 없음)
let warmedTTS = false;
function warmupTTS() {
  if (warmedTTS || typeof speechSynthesis === 'undefined') return;
  warmedTTS = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch { /* 무시 */ }
}

// 오디오 소스 라우팅: listening=마이크, speaking=TTS 엔벨로프, 그 외=무음
viz.setSource(() => {
  if (phase === 'listening') { mic.sample(); return { level: mic.getLevel(), spectrum: mic.getSpectrum() }; }
  if (phase === 'speaking') return tts.getEnvelope();
  return { level: 0, spectrum: null };
});

async function startConversation() {
  if (!speech.supported) { statusEl.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome 권장)'; return; }
  try { await mic.start(); }
  catch { statusEl.textContent = '마이크 권한이 필요합니다'; return; }
  running = true;
  emptyTurns = 0;
  document.body.dataset.running = 'true';
  orb.classList.add('active');
  orb.setAttribute('aria-pressed', 'true');
  setCaption('듣고 있어. 편하게 말해줘.'); // 온보딩 자막을 대체
  warmupTTS(); // 사용자 제스처 안에서 모바일 무음 회피(빈 utterance)
  listen();
}

function stopConversation() {
  running = false;
  document.body.dataset.running = 'false';
  orb.classList.remove('active');
  orb.setAttribute('aria-pressed', 'false');
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
    if (!text) {
      // 무발화 → 다시 듣기. 연속 4회면 마이크를 끄고 유휴 안내.
      if (++emptyTurns >= 4) {
        stopConversation();
        setCaption('잠깐 쉬고 있을게. 언제든 다시 눌러줘.');
        return;
      }
      setTimeout(listen, 350); // 모바일 인식 칩 깜빡임 완화용 디바운스
      return;
    }
    emptyTurns = 0;
    setCaption('"' + text + '"');
    await respond(text);
  };
  speech.start();
}

// 에러 코드 → 감성 사용자 카피(기술 문자열 노출 금지). 원본은 claude.js가 console.error로 남김.
function friendlyError(e) {
  if (e && e.code === 'network') return '잠깐 연결이 흔들렸어. 다시 말해줄래?';
  if (e && e.code === 'timeout') return '생각이 길어졌어. 한 번 더 들려줘.';
  return '잠깐 연결이 흔들렸어. 다시 말해줄래?';
}

async function respond(userText) {
  setPhase('thinking');
  let reply;
  try { reply = await claude.send(userText); }
  catch (e) {
    console.error('[Aura] respond failed', e);
    setPhase('idle');
    setCaption(friendlyError(e)); // 상태칩 대신 자막으로 부드럽게
    if (running) setTimeout(listen, 1600);
    return;
  }
  setCaption(reply);
  setPhase('speaking');
  // ko 보이스/TTS가 없으면 소리 없이 자막만 — 사용자에게 안내.
  if (!ttsAudible()) statusEl.textContent = '말하는 중… (소리 없이 표시 중)';
  await tts.speak(reply);
  if (running) listen();
}

// 서버 TTS는 항상 시도되지만, 폴백 speechSynthesis마저 없으면 무음일 수 있다.
function ttsAudible() {
  if (typeof speechSynthesis === 'undefined') return false;
  try { return speechSynthesis.getVoices().length > 0; } catch { return false; }
}

orb.addEventListener('click', () => (running ? stopConversation() : startConversation()));
updateReady();

let last = performance.now();
let rafId = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  tts.update(dt);
  viz.render(dt, innerWidth, innerHeight);
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  if (rafId) return;
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}
function stopLoop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

// 모션 민감/저사양: 1프레임만 정적으로 그리고 RAF 풀가동을 멈춘다(발열·멀미 방지).
// dt를 크게 줘 팔레트 lerp가 현재 페이즈 색으로 즉시 수렴하게 한다(움직임 없이 색만 반영).
function renderStaticFrame() {
  stopLoop();
  tts.update(0);
  viz.render(0.6, innerWidth, innerHeight);
}

// 탭 비활성 시 렌더 비용 0, 복귀 시 재개(모션 민감 모드는 정적 유지).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopLoop(); return; }
  if (reduceMotion.matches) renderStaticFrame();
  else startLoop();
});

// 모션 설정이 런타임에 바뀌면 즉시 반영.
const onMotionChange = () => {
  if (reduceMotion.matches) renderStaticFrame();
  else if (!document.hidden) startLoop();
};
if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);

if (reduceMotion.matches) renderStaticFrame();
else startLoop();
