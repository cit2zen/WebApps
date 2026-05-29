// 28x31 클래식 팩맨 미로.
// 기호: # 벽, . 점, o 파워펠릿, ' ' 통로(점 없음), - 유령집 문
export const COLS = 28;
export const ROWS = 31;

export const T = { EMPTY: 0, WALL: 1, PELLET: 2, POWER: 3, DOOR: 4 };

const LAYOUT = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "     #.#####.##.#####.#     ",
  "     #.##..........##.#     ",
  "     #.##.###--###.##.#     ",
  "######.##.#      #.##.######",
  "          #      #          ",
  "######.##.#      #.##.######",
  "     #.##.########.##.#     ",
  "     #.##..........##.#     ",
  "     #.#####.##.#####.#     ",
  "######.#####.##.#####.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##................##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

export class Maze {
  constructor() {
    this.reset();
  }

  reset() {
    this.grid = [];
    this.pelletCount = 0;
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      const src = LAYOUT[r] || "";
      for (let c = 0; c < COLS; c++) {
        const ch = src[c] ?? " ";
        let v = T.EMPTY;
        if (ch === "#") v = T.WALL;
        else if (ch === ".") { v = T.PELLET; this.pelletCount++; }
        else if (ch === "o") { v = T.POWER; this.pelletCount++; }
        else if (ch === "-") v = T.DOOR;
        row.push(v);
      }
      this.grid.push(row);
    }
  }

  tile(c, r) {
    if (r < 0 || r >= ROWS) return T.WALL;
    // 좌우 터널 래핑: 범위를 벗어나면 통로로 취급
    if (c < 0 || c >= COLS) return T.EMPTY;
    return this.grid[r][c];
  }

  // 팩맨용: 벽과 문은 통과 불가
  isWallForPac(c, r) {
    const t = this.tile(c, r);
    return t === T.WALL || t === T.DOOR;
  }

  // 유령용: 벽만 통과 불가 (문은 상태에 따라 ghost.js가 판단)
  isWall(c, r) {
    return this.tile(c, r) === T.WALL;
  }

  isDoor(c, r) {
    return this.tile(c, r) === T.DOOR;
  }

  eat(c, r) {
    const t = this.tile(c, r);
    if (t === T.PELLET || t === T.POWER) {
      this.grid[r][c] = T.EMPTY;
      this.pelletCount--;
      return t;
    }
    return null;
  }

  draw(ctx, tile, frame) {
    const wallColor = "#18e0ff";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.grid[r][c];
        const x = c * tile;
        const y = r * tile;
        if (t === T.WALL) {
          ctx.fillStyle = "rgba(10,20,60,0.6)";
          ctx.fillRect(x, y, tile, tile);
          ctx.strokeStyle = wallColor;
          ctx.lineWidth = Math.max(1.5, tile * 0.12);
          ctx.shadowColor = wallColor;
          ctx.shadowBlur = tile * 0.45;
          ctx.strokeRect(x + tile * 0.18, y + tile * 0.18, tile * 0.64, tile * 0.64);
          ctx.shadowBlur = 0;
        } else if (t === T.DOOR) {
          ctx.fillStyle = "#ff5bd1";
          ctx.shadowColor = "#ff5bd1";
          ctx.shadowBlur = tile * 0.4;
          ctx.fillRect(x, y + tile * 0.42, tile, tile * 0.16);
          ctx.shadowBlur = 0;
        } else if (t === T.PELLET) {
          ctx.fillStyle = "#ffe9c7";
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, Math.max(1.2, tile * 0.1), 0, Math.PI * 2);
          ctx.fill();
        } else if (t === T.POWER) {
          const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);
          ctx.fillStyle = "#fff";
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = tile * (0.4 + pulse * 0.5);
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * (0.26 + pulse * 0.06), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }
}
