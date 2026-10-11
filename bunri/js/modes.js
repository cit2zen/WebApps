// 판 종류 — stage · endless · daily(오늘의 도전) · review(복습): 상태(S) 만들기, 카드 뽑기, 결과
import { items, quiz, combos, stageOf, actOf, binsForStage } from './data.js';
import { store } from './storage.js';
import { CFG } from './engine.js';
import { firstPowerAt, MAX_HEARTS } from './powerups.js';
import { firstComboAt } from './split.js';
import { starsFor, accuracy } from './scoring.js';
import { seeded } from './daily.js';

const PREP_SHARE = 0.4;    // 손질 대잔치: 손질 카드 비율
const NOW_SHARE = 0.65;    // 단계 모드: 현재 단계 카드 비율
/** 복습 — 느린 벨트, 카드 2장까지 */
export const REVIEW_CFG = { maxOn: 2, t0: 9, t1: 8, gap0: 2.6, gap1: 2.6, time: 0, ramp: 60 };
/** 오늘의 규칙 효과 */
const MOD_FX = {
  fast: { speed: 0.85, mult: 1.2 },
  onelife: { hearts: 1, mult: 1.5 },
};

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 섞은 주머니 — 다 꺼내면 다시 섞음 */
function bag(list, rng) {
  let cur = [];
  return { size: list.length, next() { if (!cur.length) cur = shuffle(list, rng); return cur.pop(); } };
}

/** 카드 뽑기 — avoid(it)가 true면 다시 뽑음 · 단계 모드: 현재 단계 ≥60% */
export function makePicker(stage, rng = Math.random, opt = {}) {
  const all = opt.mixed || stage >= 4;
  const pool = items.filter((it) => (all ? stageOf(it) <= stage : stageOf(it) === stage));
  const now = bag(pool, rng);
  const old = bag(all ? [] : items.filter((it) => stageOf(it) < stage), rng);
  const acts = bag(opt.prep ? pool.filter((it) => actOf(it)) : [], rng);
  return (avoid) => {
    for (let i = 0; i < 6; i++) {
      const src = acts.size && rng() < PREP_SHARE ? acts : !old.size || (now.size && rng() < NOW_SHARE) ? now : old;
      const it = src.next();
      if (it && !avoid(it)) return it;
    }
    return now.next() || old.next();
  };
}

export const quizBag = (stage, rng = Math.random) => shuffle(quiz.filter((q) => stageOf(q) <= Math.min(stage, 3)), rng);

export function bonusTimes(endless) {
  const t = [25, 45];
  if (endless) for (let s = 85; s < 1200; s += 40) t.push(s);
  return t;
}

/** 이번 판에 나올 분해 카드 */
function comboPool(mode, stage) {
  if (mode === 'review') return [];
  if (mode === 'endless') return combos.slice();
  return combos.filter((c) => stageOf(c) <= stage);
}

/** 숫자(옛 방식) 또는 { mode, stage, ids?, daily? } → 정리된 run */
export function normalizeRun(run) {
  if (typeof run === 'number') return { mode: run >= 4 ? 'endless' : 'stage', stage: run };
  const r = run || {};
  const mode = ['stage', 'endless', 'daily', 'review'].includes(r.mode) ? r.mode : 'stage';
  let stage = mode === 'endless' ? 4 : Math.min(3, Math.max(1, Number(r.stage) || 1));
  let list = null;
  if (mode === 'review') {
    const ids = Array.isArray(r.ids) ? r.ids : [];
    list = [...new Set(ids)].map((id) => items.find((it) => it.id === id)).filter(Boolean);
    stage = list.reduce((m, it) => Math.max(m, stageOf(it)), 1);
  }
  return { mode, stage, list, daily: mode === 'daily' ? r.daily : null };
}

/** 리뷰 카드 뽑기 — 대기열 앞에서 */
function reviewPicker(S) {
  return (avoid) => {
    const q = S.review.pending;
    const i = q.findIndex((it) => !avoid(it));
    return i < 0 ? null : q.splice(i, 1)[0];
  };
}

/** 새 판 상태 — 시작할 수 없으면 null */
export function buildRun(raw) {
  const run = normalizeRun(raw);
  const { mode, stage, daily } = run;
  if (mode === 'review' && !(run.list && run.list.length)) return null;
  if (mode === 'daily' && !(daily && daily.mod)) return null;
  if (!binsForStage(stage).length) return null;
  const rng = mode === 'daily' ? seeded(Number(daily.seed) || 1) : Math.random;
  const mod = mode === 'daily' ? daily.mod.id : '';
  let cfg = { ...(mode === 'review' ? REVIEW_CFG : CFG[stage]) };
  if (mode === 'daily') cfg.time = 60;
  const pool = comboPool(mode, stage);
  const fx = MOD_FX[mod === 'split' && !pool.length ? 'fast' : mod] || {};
  if (fx.speed) cfg = { ...cfg, t0: cfg.t0 * fx.speed, t1: cfg.t1 * fx.speed, gap0: cfg.gap0 * fx.speed, gap1: cfg.gap1 * fx.speed };
  const S = {
    mode, stage, cfg, rng, mod, daily, ents: [], active: null, hintBin: null,
    maxHearts: fx.hearts || MAX_HEARTS, hearts: fx.hearts || MAX_HEARTS, shield: 0, scoreMult: fx.mult || 1,
    score: 0, combo: 0, maxCombo: 0, correct: 0, wrong: 0, missed: 0,
    gauge: 0, feverLeft: 0, slowLeft: 0, hint: 0, rush: false, rushLeft: 0, rushNext: 60, danger: false,
    elapsed: 0, timeMax: cfg.time, timeLeft: cfg.time, dist: 0, cardW: 100,
    bonusAt: mod === 'quiz' ? [15, 30, 45] : bonusTimes(mode === 'endless'), quiz: [],
    powerAt: mod === 'golden' ? 6 : firstPowerAt(rng), combos: pool, comboAt: Infinity,
    coach: mode === 'stage' && stage === 1 && !store.coached(),
    pause: new Set(['count']), countT: 0, countIdx: -1, mistakes: [], over: false, review: null,
  };
  S.quiz = quizBag(stage, rng);
  S.comboAt = pool.length ? (mod === 'split' ? 8 : firstComboAt(rng)) : Infinity;
  if (mode === 'review') {
    S.review = { pending: run.list.slice(), total: run.list.length, failed: new Set(), cleared: new Set(), glow: new Set() };
    S.pick = reviewPicker(S);
    S.bonusAt = []; S.powerAt = Infinity; S.comboAt = Infinity;
  } else {
    S.pick = makePicker(stage, rng, { mixed: mode === 'daily', prep: mod === 'prep' });
    if (!S.pick(() => false)) return null;
  }
  return S;
}

/** 결과 객체 — onEnd·run:end에 넘김 */
export function resultOf(S, success) {
  const endless = S.mode === 'endless';
  const plain = S.mode === 'stage';
  const r = {
    mode: S.mode, stage: S.stage, endless, success: S.mode === 'review' ? true : success && !endless, score: S.score,
    stars: plain ? starsFor(S, success) : 0, correct: S.correct, wrong: S.wrong, missed: S.missed,
    maxCombo: S.maxCombo, accuracy: accuracy(S), mistakes: S.mistakes,
  };
  if (S.mode === 'daily') { r.dailyKey = S.daily.key; r.mod = S.mod; }
  if (S.mode === 'review') { r.cleared = S.review.cleared.size; r.total = S.review.total; }
  return r;
}

/** HUD 단계 이름 — 375px에 맞게 짧게 */
export function modeLabel(S, info) {
  if (S.mode === 'review') return '📝 복습';
  if (S.mode === 'daily') return `📅 오늘 · ${S.daily.mod.icon}${String(S.daily.mod.name).split(' ')[0]}`;
  if (S.mode === 'endless') return `∞ ${info.name}`;
  return `${S.stage}단계 · ${info.name}`;
}
