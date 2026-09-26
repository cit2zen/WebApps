// bot.js — 봇 휴리스틱(가운데·최장 변 아래, §6)·헤드리스 1판·30일 측정(§3 검산 8·9)
// DOM 없음. 화면 월드와 별개로 createWorld()를 새로 만들고 저장하지 않는다. import하는 모듈은 debug.js뿐이다.
import { rotCW } from './stones.js';
import { daily, todayKST, prevDay } from './daily.js';
import { createWorld } from './physics.js';
import { chain } from './judge.js';
import { createRun } from './core.js';

const MAX_STEPS = 30000;                               // 최악 1판 21,360스텝(§8 자동화 우회) + 여유
const yieldFrame = () => new Promise(r => requestAnimationFrame(r));

// 최장 hull 변 e*(동률이면 작은 인덱스)를 아래로 두는 15° 각도. score = |y1′−y2′| + (중점 y′ > cy′ ? 1e6 : 0)
export function chooseAngle(stone) {
  const V = stone.verts, n = V.length;
  let e = 0, best = -1;
  for (let i = 0; i < n; i++) {
    const [a, b] = V[i], [c, d] = V[(i + 1) % n], L = (c - a) * (c - a) + (d - b) * (d - b);
    if (L > best) { best = L; e = i; }
  }
  const p = [V[e][0] - stone.cx, V[e][1] - stone.cy], q = [V[(e + 1) % n][0] - stone.cx, V[(e + 1) % n][1] - stone.cy];
  let arg = 0, min = Infinity;
  for (let k = 0; k < 24; k++) {                       // 동률이면 작은 각도(오름차순 + 엄격 비교)
    const y1 = rotCW(p, k)[1], y2 = rotCW(q, k)[1];   // 무게중심 기준 좌표라 cy′ = 0
    const s = Math.abs(y1 - y2) + ((y1 + y2) / 2 > 0 ? 1e6 : 0);
    if (s < min) { min = s; arg = k * 15; }
  }
  return arg;
}

// §3 검산 9: 날짜별 H가 [0.75, 1.25] × 평균 안인 날 수. pass = inBand ≥ 27/30 && floating === 0
// (합격선 29 → 27: 2026-09-26 사용자 결정 — 감쇠·스폰 간격 스윕의 최고 inBand가 27)
export function monthStats(rows, floating = 0) {
  const mean = rows.reduce((a, r) => a + r.H, 0) / (rows.length || 1);
  const inBand = rows.filter(r => r.H >= 0.75 * mean && r.H <= 1.25 * mean).length;
  return { days: rows, mean, inBand, floating, pass: inBand >= Math.ceil(rows.length * 27 / 30) && floating === 0 };
}

// 공중 부양: 안정 시점에 기하 체인 밖이고, 바위 윗면보다 위(y > 0, Matter y 반전)이며 speed < 0.01인 돌
function countFloating(W) {
  const inChain = chain(W);
  let f = 0;
  for (const b of W.stones()) if (!inChain.has(b) && -b.position.y > 0 && b.speed < 0.01) f++;
  return f;
}

function aimAndDrop(R, stone) {                        // 새 돌은 aDeg 0·x 195(규칙 6 보충)에서 시작
  const a = chooseAngle(stone), d = a <= 180 ? 1 : -1, turns = (a <= 180 ? a : 360 - a) / 15;
  for (let i = 0; i < turns; i++) R.dispatch({ t: 'rot', d });
  R.dispatch({ t: 'setX', x: 195 });
  R.dispatch({ t: 'drop' });
}

async function play(set) {
  const W = createWorld(), R = createRun(set, { mode: 'practice', W });
  let done = false, floating = 0, handled = 0, steps = 0;
  R.on('stable', () => { floating += countFloating(W); });
  R.on('done', () => { done = true; });
  try {
    while (!done) {
      const v = R.view();
      if (v.state === 'done') break;
      if (v.state === 'aim' && v.slot !== handled) { handled = v.slot; aimAndDrop(R, set.stones[v.slot - 1]); }
      R.step();
      if (++steps % 500 === 0) await yieldFrame();     // 500스텝마다 양보(§6 bot.run)
      if (steps > MAX_STEPS) throw new Error(`bot: ${set.day} ${MAX_STEPS}스텝 초과`);
    }
    return { res: R.result(), floating };
  } finally { W.destroy(); }
}

const nextDay = d => {
  const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1));
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`;
};

export async function run(day = todayKST()) { return (await play(daily(day))).res; }

// from 생략 = KST 오늘 포함 최근 days일
export async function month(from, days = 30) {
  let d = from;
  if (!d) { d = todayKST(); for (let i = 1; i < days; i++) d = prevDay(d); }
  const rows = [];
  let floating = 0;
  for (let i = 0; i < days; i++, d = nextDay(d)) {
    const r = await play(daily(d));
    rows.push({ day: d, H: r.res.H });
    floating += r.floating;
  }
  return monthStats(rows, floating);
}
