// main.js — bootstrap, game loop, wiring (game + render + input + audio + effects)

import {
  createGame, move, rotate, softDrop, hardDrop, hold, pause, tick, drainEvents,
} from './game.js';
import { COLORS } from './piece.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';

const boardEl = document.getElementById('board');
const ctx = boardEl.getContext('2d');
const holdCtx = document.getElementById('hold').getContext('2d');
const nextCtx = document.getElementById('next').getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const muteBtn = document.getElementById('mute');
const volMusic = document.getElementById('vol-music');
const volSfx = document.getElementById('vol-sfx');
const boardOverlay = document.getElementById('board-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayAction = document.getElementById('overlay-action');
const touchpad = document.getElementById('touchpad');

const audio = createAudio();
const effects = createEffects();
let game = createGame();

function clearLabel(n, tspin) {
  if (tspin === 'full') return n > 0 ? `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][n]}` : 'T-SPIN';
  if (tspin === 'mini') return 'T-SPIN MINI';
  return ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'][n];
}

function handleEvents() {
  for (const e of drainEvents(game)) {
    switch (e.type) {
      case 'move': audio.sfx('move'); break;
      case 'rotate': audio.sfx('rotate'); break;
      case 'hold': audio.sfx('hold'); break;
      case 'harddrop': audio.sfx('harddrop'); break;
      case 'levelup':
        audio.sfx('levelup');
        effects.text(`LEVEL ${e.level}`, '#a5f3fc');
        document.body.dataset.level = ((e.level - 1) % 6) + 1;
        // 7레벨 이후엔 색 순환이 반복돼 진행감이 사라지므로,
        // 누적 레벨에 비례한 연속 hue 회전으로 정체감을 없앤다.
        document.body.style.setProperty('--level-hue', `${(e.level - 1) * 24}deg`);
        break;
      case 'gameover': audio.sfx('gameover'); break;
      case 'clear': {
        const big = e.n >= 4 || e.tspin === 'full';
        if (e.tspin !== 'none') audio.sfx('tspin');
        if (e.n > 0) audio.sfx('clear', e.n);
        if (e.rows && e.rows.length) effects.burst(e.rows, big);
        const label = clearLabel(e.n, e.tspin);
        if (label) {
          const colors = { TETRIS: '#22d3ee' };
          effects.text(label, e.tspin !== 'none' ? '#f0abfc' : (colors[label] || '#fde68a'));
        }
        if (e.gained) effects.text(`+${e.gained}`, '#fef9c3');
        break;
      }
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  input.update(dt);
  tick(game, dt);
  handleEvents();
  audio.tick();
  effects.update(dt);
  render(ctx, game, holdCtx, nextCtx, effects);
  scoreEl.textContent = game.score.toLocaleString();
  linesEl.textContent = game.lines;
  levelEl.textContent = game.level;
  syncOverlay();
  requestAnimationFrame(loop);
}

// 키보드 없는 기기를 위해 게임오버/일시정지를 실제 DOM 버튼으로 노출.
let overlayState = '';
function syncOverlay() {
  if (game.state === overlayState) return;
  overlayState = game.state;
  if (game.state === 'over') {
    overlayTitle.textContent = 'GAME OVER · 게임 오버';
    overlayAction.textContent = '다시 하기';
    boardOverlay.hidden = false;
    overlayAction.focus();
  } else if (game.state === 'paused') {
    overlayTitle.textContent = 'PAUSE · 일시정지';
    overlayAction.textContent = '계속하기';
    boardOverlay.hidden = false;
  } else {
    boardOverlay.hidden = true;
  }
}

const input = createInput({
  left: () => move(game, -1, 0),
  right: () => move(game, 1, 0),
  softDrop: () => softDrop(game),
  rotateCW: () => rotate(game, 1),
  rotateCCW: () => rotate(game, -1),
  hardDrop: () => hardDrop(game),
  hold: () => hold(game),
  pause: () => pause(game),
  restart: () => doRestart(),
  mute: () => updateMute(),
});

function doRestart() {
  game = createGame();
  document.body.dataset.level = 1;
  document.body.style.setProperty('--level-hue', '0deg');
}

// 게임오버=재시작, 일시정지=재개. 키보드 없이 터치만으로 조작 가능.
overlayAction.addEventListener('click', () => {
  if (game.state === 'over') doRestart();
  else if (game.state === 'paused') pause(game);
});

// 모바일 온스크린 D-pad
const TP = {
  left: () => move(game, -1, 0),
  right: () => move(game, 1, 0),
  rotate: () => rotate(game, 1),
  soft: () => softDrop(game),
  hard: () => hardDrop(game),
  hold: () => hold(game),
};
touchpad.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.tp-btn');
  if (!btn) return;
  e.preventDefault();
  const fn = TP[btn.dataset.act];
  if (fn) fn();
});
// 보드 위 스와이프 제스처
input.bindTouch(boardEl);

function updateMute() {
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? '♪ OFF' : '♪ ON';
  muteBtn.classList.toggle('off', muted);
}

// unlock audio + start music on first interaction (browser autoplay policy)
function startAudio() {
  audio.startMusic();
  window.removeEventListener('keydown', startAudio);
  window.removeEventListener('pointerdown', startAudio);
}
window.addEventListener('keydown', startAudio);
window.addEventListener('pointerdown', startAudio);
muteBtn.addEventListener('click', updateMute);
volMusic.addEventListener('input', () => audio.setMusicVolume(volMusic.value / 100));
volSfx.addEventListener('input', () => audio.setSfxVolume(volSfx.value / 100));

document.body.dataset.level = 1;
requestAnimationFrame(loop);
