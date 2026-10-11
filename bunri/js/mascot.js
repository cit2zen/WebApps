// 마스코트 '척척이' — 로비·플레이·결과에서 이벤트에 반응 (events.js 구독)
import { $ } from './dom.js';
import { on } from './events.js';
import { createBot } from './bot.js';
import { TIPS, GREET, CORRECT, PLAY, resultLine, pick } from './mascot-lines.js';
import './haptics.js';

const GAP_MS = 900; // 말풍선 최소 간격

/** 말풍선 우선순위 조절 — 0.9초 안에는 더 중요한 말만 끼어듦 */
function speaker(bot) {
  let last = 0;
  let lastPrio = 0;
  return (text, prio = 1, ms = 1500) => {
    const now = performance.now();
    if (now - last < GAP_MS && prio <= lastPrio) return;
    last = now;
    lastPrio = prio;
    bot.say(text, ms);
  };
}

/* 로비 — 스티커 묶음 가운데, 누르면 팁 */
function initLobby() {
  const slot = $('#lb-mascot');
  if (!slot) return;
  const bot = createBot('lobby');
  slot.append(bot.root);
  let tipIdx = Math.floor(Math.random() * TIPS.length);
  let tapped = false;
  slot.addEventListener('click', () => {
    tapped = true;
    tipIdx = (tipIdx + 1 + Math.floor(Math.random() * (TIPS.length - 1))) % TIPS.length;
    bot.mood('happy', 1200);
    bot.say(TIPS[tipIdx], 3200);
  });
  on('screen', ({ name }) => {
    if (name !== 'lobby') { bot.hush(); return; }
    bot.wave();
    bot.mood('happy', 1600);
  });
  // 처음 열 때 인사
  setTimeout(() => { if (!tapped && !$('#lobby')?.hidden) bot.say(pick(GREET), 2200); }, 700);
}

/* 플레이 — 벨트 위 하늘 띠 왼쪽 */
function initPlay() {
  const sky = $('#play-mascot') || $('#play .belt-sky');
  if (!sky) return;
  const bot = createBot('play');
  sky.append(bot.root);
  const say = speaker(bot);
  let corrects = 0;
  let danger = false;

  on('run:start', () => {
    corrects = 0;
    danger = false;
    bot.hush();
    bot.setBase('idle');
    bot.mood('happy', 1200);
    say(PLAY.start, 2);
  });
  on('correct', ({ fever }) => {
    corrects++;
    bot.mood(fever ? 'cheer' : 'happy', 600);
    if (corrects % 4 === 0) say(pick(CORRECT), 1, 1000);
  });
  on('combo', ({ combo }) => { bot.mood('cheer', 900); say(PLAY.combo(combo), 2); });
  on('fever', ({ on: isOn }) => { if (isOn) { bot.mood('cheer', 1200); say(PLAY.fever, 3); } });
  on('wrong', () => { bot.mood('sad', 1600); say(PLAY.wrong, 3, 1800); });
  on('miss', () => { bot.mood('sad', 1200); say(PLAY.miss, 3); });
  on('danger', ({ on: isOn }) => {
    if (isOn === danger) return;
    danger = !!isOn;
    bot.setBase(danger ? 'worried' : 'idle');
    if (danger) { bot.mood('worried', 0); say(PLAY.danger, 2, 1100); }
  });
  on('rush', ({ on: isOn }) => { if (isOn) { bot.mood('cheer', 1000); say(PLAY.rush, 3); } });
  on('split', () => { bot.mood('happy', 900); say(PLAY.split, 2); });
  on('shield', () => { bot.mood('happy', 1200); say(PLAY.shield, 3, 1800); });
  on('bonus', ({ ok }) => {
    if (ok) { bot.mood('cheer', 1200); say(PLAY.bonus, 2); } else bot.mood('sad', 900);
  });
  on('power', () => { bot.mood('cheer', 1000); say(PLAY.power, 2); });
  on('pause', ({ why }) => { if (why === 'menu') { bot.hush(); bot.mood('sleep', 0); } });
  on('unpause', ({ why }) => { if (why === 'menu') bot.mood(bot.base, 1); });
  on('screen', ({ name }) => { if (name !== 'play') { bot.hush(); bot.setBase('idle'); bot.mood('idle', 1); } });
}

/* 결과 — 결과 카드 맨 위 */
function initResult() {
  const slot = $('#res-mascot');
  if (!slot) return;
  const bot = createBot('result');
  slot.append(bot.root);
  let lastRun = null;
  on('run:end', (r) => { lastRun = r; });
  on('screen', ({ name }) => {
    if (name !== 'result') { bot.hush(); return; }
    const [mood, line] = resultLine(lastRun);
    bot.setBase(mood === 'sad' ? 'sad' : 'happy');
    bot.mood(mood, 2400);
    setTimeout(() => bot.say(line, 3200), 350);
  });
}

initLobby();
initPlay();
initResult();
