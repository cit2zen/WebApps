// js/daily.js — KST 날짜·회차·데일리 세트(규칙 1·16). 순수 함수만(URL 파라미터 parseParams는 2단계에서 추가)
import { generate } from './stones.js';
import { fnv } from './rng.js';

export const LAUNCH = '20261001';
const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;
let override = null;

const toUTC = day => Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8));
const fromUTC = ms => {
  const d = new Date(ms);
  return String(d.getUTCFullYear()).padStart(4, '0') +
    String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
};

// "YYYYMMDD" 정규식 + 실제 날짜 왕복 검증(20261301·20260230 거부)
export function isDay(s) {
  return typeof s === 'string' && /^\d{8}$/.test(s) && fromUTC(toUTC(s)) === s;
}

export function todayKST() {
  return override ?? fromUTC(Date.now() + KST_MS);
}

// 테스트 훅 전용 덮어쓰기(규칙 1). null이면 해제. 형식이 틀리면 무시한다. 반환 = 적용 뒤 오늘
export function setToday(day) {
  if (day === null) override = null;
  else if (isDay(day)) override = day;
  return todayKST();
}

export function addDays(day, k) { return fromUTC(toUTC(day) + k * DAY_MS); }
export function prevDay(day) { return addDays(day, -1); }

// #N = (day − 2026-10-01)일 + 1. 출시 전은 0 이하
export function nOf(day) { return Math.round((toUTC(day) - toUTC(LAUNCH)) / DAY_MS) + 1; }

// 출시 전 카운트다운 D-n(= 10월 1일까지 남은 일수). nOf(day) ≤ 0일 때만 의미가 있다
export function dDay(day) { return 1 - nOf(day); }

export function daily(day = todayKST()) {
  return generate(fnv(day), day, nOf(day));
}
