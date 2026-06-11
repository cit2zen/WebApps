// game.js — game state machine: gravity, scoring, hold, next queue, T-spin

import { createGrid, collides, lockCells, clearLines } from './board.js';
import { TYPES, cellsOf, spawnPiece, getKicks, ROWS, COLS } from './piece.js';

const LOCK_DELAY = 500; // ms grounded before locking
const MAX_LOCK_TIME = 1000; // 바닥에 처음 닿은 뒤 강제로 고정되기까지의 누적 시간 상한
const gravityMs = (level) =>
  Math.max(Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000, 1);

export function createGame(state = 'playing') {
  const g = {
    grid: createGrid(),
    current: null,
    hold: null,
    queue: [],
    score: 0,
    lines: 0,
    level: 1,
    state, // ready | playing | paused | over
    gravityTimer: 0,
    lockTimer: 0,
    lockStarted: false,
    groundedElapsed: 0,
    canHold: true,
    lastRotation: false,
    lastKick: 0,
    events: [],
  };
  spawnNext(g);
  return g;
}

export function drainEvents(g) {
  const e = g.events;
  g.events = [];
  return e;
}

function emit(g, type, data) {
  g.events.push({ type, ...data });
}

function refill(g) {
  while (g.queue.length < 7) {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    g.queue.push(...bag);
  }
}

export function spawnNext(g) {
  refill(g);
  g.current = spawnPiece(g.queue.shift());
  g.lockTimer = 0;
  g.lockStarted = false;
  g.groundedElapsed = 0;
  g.lastRotation = false;
  if (collides(g.grid, cellsOf(g.current))) {
    g.state = 'over';
    emit(g, 'gameover');
  }
}

function onGround(g) {
  return collides(g.grid, cellsOf({ ...g.current, y: g.current.y + 1 }));
}

function resetLockIfGround(g) {
  // 이동/회전 시 락 타이머(마지막 조작 후 0.5초)는 리셋해 조작 여유를 주되,
  // 누적 체류 시간(groundedElapsed)은 tick에서 따로 쌓여 상한을 강제한다.
  if (onGround(g)) g.lockTimer = 0;
}

export function move(g, dx, dy) {
  if (g.state !== 'playing') return false;
  const next = { ...g.current, x: g.current.x + dx, y: g.current.y + dy };
  if (collides(g.grid, cellsOf(next))) return false;
  g.current = next;
  g.lastRotation = false;
  if (dy === 0) {
    resetLockIfGround(g);
    emit(g, 'move');
  }
  return true;
}

export function rotate(g, dir) {
  if (g.state !== 'playing') return false;
  const p = g.current;
  const to = (p.rot + dir + 4) % 4;
  const kicks = getKicks(p.type, p.rot, to);
  for (let i = 0; i < kicks.length; i++) {
    const [kx, ky] = kicks[i];
    const test = { ...p, rot: to, x: p.x + kx, y: p.y - ky };
    if (!collides(g.grid, cellsOf(test))) {
      g.current = test;
      g.lastRotation = true;
      g.lastKick = i;
      resetLockIfGround(g);
      emit(g, 'rotate');
      return true;
    }
  }
  return false;
}

export function softDrop(g) {
  if (move(g, 0, 1)) g.score += 1;
}

export function hardDrop(g) {
  if (g.state !== 'playing') return;
  let dist = 0;
  while (move(g, 0, 1)) dist++;
  g.score += dist * 2;
  emit(g, 'harddrop');
  lockDown(g);
}

export function hold(g) {
  if (g.state !== 'playing') return;
  if (!g.canHold) return; // 조각당 1회만 홀드 가능
  const cur = g.current.type;
  if (g.hold) {
    g.current = spawnPiece(g.hold);
    g.hold = cur;
    g.lastRotation = false;
    g.lockTimer = 0;
    g.lockStarted = false;
    g.groundedElapsed = 0;
    if (collides(g.grid, cellsOf(g.current))) {
      g.state = 'over';
      emit(g, 'gameover');
    }
  } else {
    g.hold = cur;
    spawnNext(g);
  }
  g.canHold = false;
  emit(g, 'hold');
}

export function pause(g) {
  if (g.state === 'playing') g.state = 'paused';
  else if (g.state === 'paused') g.state = 'playing';
}

export function tick(g, dt) {
  if (g.state !== 'playing') return;
  g.gravityTimer += dt;
  const interval = gravityMs(g.level);
  while (g.gravityTimer >= interval) {
    g.gravityTimer -= interval;
    if (!onGround(g)) {
      g.current = { ...g.current, y: g.current.y + 1 };
      g.lastRotation = false;
    }
  }
  const ground = onGround(g);
  if (ground) {
    g.lockStarted = true;
    g.lockTimer += dt;
  } else {
    g.lockTimer = 0;
  }
  // 바닥에 한 번 닿은 뒤로는 공중에 떠 있어도 누적 시간을 잰다.
  // 이동·회전(킥 부양 포함)으로 lockTimer를 아무리 리셋해도
  // 누적 시간이 상한을 넘으면 강제로 고정 → 무한 지연 불가.
  if (g.lockStarted) g.groundedElapsed += dt;
  if (ground && (g.lockTimer >= LOCK_DELAY || g.groundedElapsed >= MAX_LOCK_TIME)) {
    lockDown(g);
  }
}

function detectTSpin(g, p) {
  if (p.type !== 'T' || !g.lastRotation) return 'none';
  const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
  const occ = corners.map(([cx, cy]) => {
    const x = p.x + cx, y = p.y + cy;
    return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && g.grid[y][x] !== null);
  });
  if (occ.filter(Boolean).length < 3) return 'none';
  const frontIdx = { 0: [0, 1], 1: [1, 3], 2: [2, 3], 3: [0, 2] }[p.rot];
  const frontOcc = frontIdx.filter((i) => occ[i]).length;
  return frontOcc === 2 || g.lastKick === 4 ? 'full' : 'mini';
}

function scoreFor(n, tspin, level) {
  let pts;
  if (tspin === 'full') pts = [400, 800, 1200, 1600][n];
  else if (tspin === 'mini') pts = [100, 200, 400][n] || 100;
  else pts = [0, 100, 300, 500, 800][n];
  return pts * level;
}

function lockDown(g) {
  const p = g.current;
  const tspin = detectTSpin(g, p);
  lockCells(g.grid, cellsOf(p), p.type);
  emit(g, 'lock');
  const cleared = clearLines(g.grid);
  const n = cleared.length;
  const gained = scoreFor(n, tspin, g.level);
  g.score += gained;
  const prevLevel = g.level;
  g.lines += n;
  g.level = Math.floor(g.lines / 10) + 1;
  if (n > 0 || (tspin !== 'none')) {
    emit(g, 'clear', { n, tspin, rows: cleared, gained });
  }
  if (g.level > prevLevel) emit(g, 'levelup', { level: g.level });
  spawnNext(g);
  g.canHold = true;
}
