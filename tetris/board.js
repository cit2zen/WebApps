// board.js — grid state, collision, line clearing

import { COLS, ROWS } from './piece.js';

export function createGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

export function collides(grid, cells) {
  return cells.some(([x, y]) =>
    x < 0 || x >= COLS || y >= ROWS || (y >= 0 && grid[y][x] !== null)
  );
}

export function lockCells(grid, cells, type) {
  cells.forEach(([x, y]) => {
    if (y >= 0) grid[y][x] = type;
  });
}

// returns the cleared rows as [{ y, cells }] (cells captured before removal)
export function clearLines(grid) {
  const cleared = [];
  for (let y = 0; y < ROWS; y++) {
    if (grid[y].every((c) => c !== null)) cleared.push({ y, cells: [...grid[y]] });
  }
  if (cleared.length) {
    const keep = grid.filter((row) => !row.every((c) => c !== null));
    while (keep.length < ROWS) keep.unshift(new Array(COLS).fill(null));
    for (let y = 0; y < ROWS; y++) grid[y] = keep[y];
  }
  return cleared;
}
