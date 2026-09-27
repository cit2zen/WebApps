// core.js — 1판 규칙 엔진(DOM 없음, §6). 상태: aim → drop → settle → (aim | hold) → done(내부 전용).
// 모든 타이머는 물리 스텝 수로 센다(§2 규칙 4).
import { isCalm, fallen, chain, topY, isPerfect } from './judge.js';
import { createRecord, buildResult, toH, SLOTS } from './record.js';
import { SPAWN_GAP } from './camera.js';                // 스폰 간격 단일 출처(§3 고정 파라미터)

export const T = { AIM: 600, DROP: 90, CALM: 30, FORCE: 180, HOLD: 180, TICK: 60 };
export const X_MIN = 25, X_MAX = 365, X0 = 195, CANDLES = 3;
export { SPAWN_GAP };
const EVENTS = ['land', 'fall', 'perfect', 'combo0', 'milestone', 'stable', 'aim',
  'skip', 'hold', 'holdTick', 'done', 'firstDrop', 'height'];
const clampX = x => Math.min(X_MAX, Math.max(X_MIN, x));
const norm = a => ((a % 360) + 360) % 360;

export function createRun(set, { mode, W, tryNo = null }) {
  const fns = Object.fromEntries(EVENTS.map(e => [e, []]));
  const emit = (e, p) => { for (const fn of fns[e]) fn(p); };
  const rec = createRecord();
  const s = {
    state: 'aim', slot: 1, candles: CANDLES, skipUsed: false, combo: 0,
    Y: 0, milestone: 0, fell: 0, rotBuf: 0, firstDropped: false,
    aim: { x: X0, aDeg: 0, stepsLeft: T.AIM },
    cur: null, contact: false, dropSteps: 0, settleSteps: 0, calmSteps: 0, holdSteps: 0,
    pendingAim: true, last: null,
  };
  W.onFirstContact(body => { if (body === s.cur) s.contact = true; });

  const flushAim = () => {
    if (!s.pendingAim) return;
    s.pendingAim = false;
    emit('aim', { slot: s.slot, next: [s.slot + 1, s.slot + 2].filter(i => i <= SLOTS) });
  };

  // chain() 호출 지점 3곳(안정·낙석 스텝·hold 종료)에서만 부른다. 매번 height 이벤트.
  const measure = () => {
    s.Y = topY(chain(W));
    const H = toH(s.Y);
    emit('height', { Y: s.Y, H });
    while (Math.floor(H / 50) > s.milestone) { s.milestone++; emit('milestone', { cm: s.milestone * 50 }); }
  };

  const enterAim = () => {
    s.state = 'aim'; s.cur = null;
    s.aim = { x: X0, aDeg: norm(15 * s.rotBuf), stepsLeft: T.AIM };   // 버퍼 회전은 aim 진입 스텝에 즉시 적용
    s.rotBuf = 0; s.pendingAim = true;
    flushAim();
  };

  const enterHold = reason => {
    s.state = 'hold'; s.holdSteps = 0; s.cur = null;
    emit('hold', { reason });
  };

  const nextSlot = () => { if (s.slot >= SLOTS) enterHold('done'); else { s.slot++; enterAim(); } };

  const drop = () => {
    const stone = set.stones[s.slot - 1];
    const spawnY = s.Y + SPAWN_GAP;
    const body = W.dropStone(stone, s.aim.x, spawnY, s.aim.aDeg);
    s.last = { slot: s.slot, x: s.aim.x, spawnY, aDeg: s.aim.aDeg, body };
    rec.placed(s.slot);
    s.cur = body; s.contact = false; s.dropSteps = 0; s.state = 'drop';
    if (!s.firstDropped) { s.firstDropped = true; emit('firstDrop', { slot: s.slot }); }
  };

  const stable = () => {
    measure();
    const cur = s.cur;
    if (cur && W.stones().includes(cur)) {
      if (isPerfect(W, cur)) { s.combo++; rec.perfect(cur.slot); emit('perfect', { slot: cur.slot, combo: s.combo }); }
      else if (s.combo > 0) { s.combo = 0; emit('combo0', {}); }
    }
    emit('stable', { slot: s.slot, Y: s.Y, H: toH(s.Y) });
    nextSlot();
  };

  const checkFalls = () => {
    const out = W.stones().filter(fallen);
    if (!out.length) return false;
    for (const b of out) {
      W.remove(b); rec.fell(b.slot); s.fell++;
      if (b === s.cur) s.cur = null;
      if (s.state !== 'hold') s.candles = Math.max(0, s.candles - 1);   // hold 중엔 차감 없음
      emit('fall', { slot: b.slot, candles: s.candles });
    }
    if (s.state !== 'hold' && s.combo > 0) { s.combo = 0; emit('combo0', {}); }
    measure();
    if (s.state !== 'hold' && s.candles === 0) { enterHold('candles'); return true; }
    return false;
  };

  const R = {
    on(evt, fn) { if (!fns[evt]) throw new Error('unknown event ' + evt); fns[evt].push(fn); return R; },
    dispatch(a) {
      flushAim();
      if (s.state === 'settle' && a.t === 'rot') { if (s.rotBuf === 0) s.rotBuf = a.d > 0 ? 1 : -1; return; }
      if (s.state !== 'aim') return;
      switch (a.t) {
        case 'move': s.aim.x = clampX(s.aim.x + a.dx); break;
        case 'setX': case 'cancel': s.aim.x = clampX(a.x); break;
        case 'rot': s.aim.aDeg = norm(s.aim.aDeg + (a.d > 0 ? 15 : -15)); break;
        case 'drop': drop(); break;
        case 'skip':
          if (s.skipUsed) return;
          s.skipUsed = true; rec.skip(s.slot); emit('skip', { slot: s.slot }); nextSlot(); break;
        default: break;
      }
    },
    step() {
      if (s.state === 'done') return;
      flushAim();
      W.step();
      if (checkFalls()) return;
      switch (s.state) {
        case 'aim':
          if (--s.aim.stepsLeft <= 0) drop();                  // 10초 자동 낙하
          break;
        case 'drop':
          if (s.contact) { s.state = 'settle'; s.settleSteps = 0; s.calmSteps = 0; emit('land', { slot: s.slot, combo: s.combo }); }
          else if (++s.dropSteps >= T.DROP) { s.state = 'settle'; s.settleSteps = 0; s.calmSteps = 0; }
          break;
        case 'settle':
          s.settleSteps++;
          s.calmSteps = isCalm(W.stones()) ? s.calmSteps + 1 : 0;
          if (s.calmSteps >= T.CALM || s.settleSteps >= T.FORCE) stable();
          break;
        case 'hold':
          s.holdSteps++;
          if (s.holdSteps >= T.HOLD) { measure(); s.state = 'done'; emit('done', R.result()); }
          else if (s.holdSteps % T.TICK === 0) emit('holdTick', { t: 3 - s.holdSteps / T.TICK });
          break;
        default: break;
      }
    },
    view() {
      const stones = W.stones();
      return {
        state: s.state, mode, day: set.day, n: set.n, seed: set.seed,
        slot: s.slot, candles: s.candles, skipUsed: s.skipUsed, combo: s.combo,
        Y: s.Y, H: toH(s.Y), left: stones.length, fell: s.fell, perfect: rec.counts().perfect,
        aim: { ...s.aim },
        bodies: stones.map(b => ({ i: b.slot, x: b.position.x, y: -b.position.y, angle: b.angle, sleeping: b.isSleeping })),
      };
    },
    result() { return buildResult({ set, mode, tryNo, Y: s.Y, rec, skipped: s.skipUsed }); },
    lastDrop() { return s.last; },
  };
  return R;
}
