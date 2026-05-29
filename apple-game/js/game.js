// 게임 상태와 격자 규칙. 렌더링/입력은 board.js가 담당.
export const COLS = 17;
export const ROWS = 10;
const TARGET = 10;

// 길이 len을 [2,10] 범위의 구간 길이들로 분할(합10 구간은 최소 2칸 필요).
// 남는 칸이 1이 되지 않게 해서 항상 채워지도록 한다.
// 짧은 구간일수록 칸당 숫자가 커진다(2칸이면 4+6, 9+1 등). 짧은 길이에 가중치.
function pickWeighted(cands) {
  const w = cands.map((l) => (l === 2 ? 12 : l === 3 ? 4 : l === 4 ? 1 : l === 5 ? 0.15 : 0.02));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x < 0) return cands[i]; }
  return cands[cands.length - 1];
}

function splitLengths(len) {
  const lens = [];
  let rem = len;
  while (rem > 0) {
    const maxL = Math.min(10, rem);
    const cands = [];
    for (let l = 2; l <= maxL; l++) if (rem - l === 0 || rem - l >= 2) cands.push(l);
    const L = pickWeighted(cands);
    lens.push(L);
    rem -= L;
  }
  return lens;
}

// 1~9 사이 L개의 수로 합이 정확히 10이 되는 구간 생성.
// 각 칸을 "나머지를 남은 칸으로 채울 수 있는" 범위 안에서 직접 무작위 추출 → 8·9 같은 큰 수도 고루 등장.
function segment(L) {
  const arr = [];
  let rem = 10;
  for (let k = 0; k < L; k++) {
    const left = L - 1 - k; // 이 칸 이후 남은 칸 수
    const lo = Math.max(1, rem - 9 * left);
    const hi = Math.min(9, rem - left);
    const v = lo + ((Math.random() * (hi - lo + 1)) | 0);
    arr.push(v);
    rem -= v;
  }
  for (let k = L - 1; k > 0; k--) { // 마지막 칸이 항상 나머지가 되지 않도록 셔플
    const j = (Math.random() * (k + 1)) | 0;
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

// total을 [lo,hi] 범위 부분들로 분할(나머지가 lo 미만으로 남지 않게).
function partition(total, lo, hi) {
  const parts = [];
  let rem = total;
  while (rem > 0) {
    const maxP = Math.min(hi, rem);
    const cands = [];
    for (let p = lo; p <= maxP; p++) if (rem - p === 0 || rem - p >= lo) cands.push(p);
    const p = cands[(Math.random() * cands.length) | 0];
    parts.push(p);
    rem -= p;
  }
  return parts;
}

export class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.cells = new Array(COLS * ROWS).fill(0);
    // 보드를 블록으로 나누고 블록마다 가로/세로 방향을 무작위로 정해
    // 각 방향의 합10 직선 구간으로 채운다 → 가로·세로 그룹이 섞이며 전체 클리어 보장.
    const colChunks = partition(COLS, 2, 6);
    const rowChunks = partition(ROWS, 2, 5);
    let y = 0;
    for (const h of rowChunks) {
      let x = 0;
      for (const w of colChunks) {
        this._fillBlock(x, y, w, h, Math.random() < 0.5 ? "h" : "v");
        x += w;
      }
      y += h;
    }
  }

  _fillBlock(x0, y0, w, h, orient) {
    const put = (x, y, v) => { this.cells[y * COLS + x] = v; };
    if (orient === "h") {
      for (let r = 0; r < h; r++) {
        let cx = 0;
        for (const L of splitLengths(w)) {
          const seg = segment(L);
          for (let k = 0; k < L; k++) put(x0 + cx + k, y0 + r, seg[k]);
          cx += L;
        }
      }
    } else {
      for (let c = 0; c < w; c++) {
        let cy = 0;
        for (const L of splitLengths(h)) {
          const seg = segment(L);
          for (let k = 0; k < L; k++) put(x0 + c, y0 + cy + k, seg[k]);
          cy += L;
        }
      }
    }
  }

  valueAt(index) {
    return this.cells[index];
  }

  // 남아있는 사과 수(값>0).
  remaining() {
    let n = 0;
    for (const v of this.cells) if (v > 0) n++;
    return n;
  }

  // 주어진 인덱스 목록 중 사과(값>0)들의 합.
  sumOf(indices) {
    let s = 0;
    for (const i of indices) s += this.cells[i];
    return s;
  }

  // 합이 정확히 10이면 해당 칸을 비우고 점수를 올린다. 수확 개수 반환(0이면 실패).
  harvest(indices) {
    const picked = indices.filter((i) => this.cells[i] > 0);
    if (picked.length === 0 || this.sumOf(picked) !== TARGET) return 0;
    for (const i of picked) this.cells[i] = 0;
    this.score += picked.length;
    return picked.length;
  }
}
