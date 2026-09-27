// record.js — 슬롯 24개 상태(E/S/P/X)·퍼펙트 표시·RunResult 조립·사전식 비교(§5·§6). DOM 없음.
// 슬롯 상태: E = 미배치·건너뜀, S = 남음, X = 낙석. P(퍼펙트·남음)는 grid() 조립 때 S 위에 덮는다.
export const SLOTS = 24;

// H(cm) = round(5·Y)/10 (§3). Y는 월드 px.
export const toH = Y => Math.round(5 * Y) / 10;

export function createRecord() {
  const st = new Array(SLOTS).fill('E');
  const perf = new Array(SLOTS).fill(false);
  const at = i => {
    if (!Number.isInteger(i) || i < 1 || i > SLOTS) throw new RangeError('slot ' + i);
    return i - 1;
  };
  return {
    placed(i) { st[at(i)] = 'S'; },
    fell(i) { const k = at(i); st[k] = 'X'; perf[k] = false; },
    skip(i) { const k = at(i); st[k] = 'E'; perf[k] = false; },
    perfect(i) { perf[at(i)] = true; },
    state(i) { return st[at(i)]; },
    grid() { return st.map((c, k) => (c === 'S' && perf[k] ? 'P' : c)).join(''); },
    counts() {
      const g = this.grid();
      let P = 0, S = 0, X = 0;
      for (const c of g) { if (c === 'P') P++; else if (c === 'S') S++; else if (c === 'X') X++; }
      return { left: P + S, perfect: P, fell: X };
    },
  };
}

// RunResult 조립(§5 스키마). set = DailySet, mode ∈ official|practice|random, tryNo = 1~3 | null.
export function buildResult({ set, mode, tryNo = null, Y, rec, skipped }) {
  const H = toH(Y);
  const { left, perfect, fell } = rec.counts();
  return {
    day: set.day, n: set.n, mode, try: tryNo,
    Y, H, c: Math.round(H * 10), left, perfect, fell,
    skipped: !!skipped, grid: rec.grid(),
  };
}

// (H, left, perfect) 사전식 비교. a > b 이면 양수, 같으면 0, 작으면 음수.
export function cmp(a, b) {
  return (a.H - b.H) || (a.left - b.left) || (a.perfect - b.perfect);
}
