// js/storage.js — localStorage 'doltap:v1' 1키(§6 저장 표). 모든 접근은 try/catch, 실패하면 메모리 객체만 쓴다
import { todayKST, prevDay, addDays } from './daily.js';

const KEY = 'doltap:v1';
const KEEP_DAYS = 60;                       // 오늘 −59일까지 보관
const BEST_FIELDS = ['Y', 'H', 'c', 'left', 'perfect', 'fell', 'skipped', 'grid'];
const SETTINGS = {
  sound: v => typeof v === 'boolean',
  vibe: v => typeof v === 'boolean',
  hand: v => v === 'R' || v === 'L',
  tutDone: v => typeof v === 'boolean',
};

const fresh = () => ({ v: 1, days: {}, streak: 0, maxStreak: 0, lastDay: null, bestEver: 0,
  sound: true, vibe: true, hand: 'R', tutDone: false });

let S = null;
let canPersist = true;

function ls() { return globalThis.localStorage; }

// JSON 파싱 실패·v !== 1이면 기본 객체(다음 쓰기에서 덮어씀). 접근 예외면 persist() = false
export function load() {
  if (S) return S;
  S = fresh();
  try {
    const raw = ls().getItem(KEY);
    if (raw !== null) {
      const o = JSON.parse(raw);
      if (o && o.v === 1 && typeof o.days === 'object' && o.days !== null) S = { ...fresh(), ...o };
    }
  } catch (e) {
    if (!(e instanceof SyntaxError)) canPersist = false;
  }
  return S;
}

export function persist() { load(); return canPersist; }

function prune(today) {
  const oldest = addDays(today, -(KEEP_DAYS - 1));
  for (const d of Object.keys(S.days)) if (d < oldest) delete S.days[d];
}

function write() {
  prune(todayKST());
  if (!canPersist) return;
  try { ls().setItem(KEY, JSON.stringify(S)); } catch { canPersist = false; }
}

function dayRec(day) {
  load();
  if (!S.days[day]) S.days[day] = { tries: 0, best: null };
  return S.days[day];
}

// 첫 낙하 때 공식 도전 차감(tries+1, 상한 3). 반환 = 갱신된 tries
export function bumpTries(day) {
  const d = dayRec(day);
  d.tries = Math.min(3, d.tries + 1);
  write();
  return d.tries;
}

// (H, left, perfect) 사전식 비교(§3 판 순위)
const lexGreater = (a, b) => a.H !== b.H ? a.H > b.H : a.left !== b.left ? a.left > b.left : a.perfect > b.perfect;

// 공식 결과 저장(day = 판 시작 날짜). newBest = 개인 최고(bestEver) 경신 여부
export function commitResult(day, run) {
  const d = dayRec(day);
  if (!d.best || lexGreater(run, d.best)) {
    d.best = {};
    for (const k of BEST_FIELDS) d.best[k] = run[k];
  }
  const newBest = run.H > S.bestEver;
  S.bestEver = Math.max(S.bestEver, run.H);
  S.streak = S.lastDay === prevDay(day) ? S.streak + 1 : S.lastDay === day ? S.streak : 1;
  S.lastDay = day;
  S.maxStreak = Math.max(S.maxStreak, S.streak);
  write();
  return { newBest, streak: S.streak };
}

// 설정 4종(sound·vibe·hand·tutDone)만 허용
export function set(field, v) {
  load();
  if (!Object.hasOwn(SETTINGS, field) || !SETTINGS[field](v)) throw new TypeError(`storage.set: ${field}=${v}`);
  S[field] = v;
  write();
  return v;
}

// 표시 streak(§6 정합 #4)
export function displayStreak(today = todayKST()) {
  load();
  if (!canPersist) return Math.max(1, S.streak);
  return S.lastDay === today || S.lastDay === prevDay(today) ? S.streak : 0;
}

export function wipe() {
  S = fresh();
  try { ls().removeItem(KEY); } catch { canPersist = false; }
  return true;
}
