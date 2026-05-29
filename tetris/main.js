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
  requestAnimationFrame(loop);
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
  restart: () => { game = createGame(); document.body.dataset.level = 1; },
  mute: () => updateMute(),
});

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
