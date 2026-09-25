// daily.js — '오늘의 한붓'(포스트MVP): 색인 i(§5 정본) · levels_daily.json 지연 로드 · hanbut:daily 기록 · 로비 버튼
// DOM 접근은 함수 안에서만(game.js가 import — node 스모크에서도 import 가능).
import { loadLevels } from './levels.js';
import * as store from './store.js';
import { setText, setRaw, fmt } from './strings.js';

export const DAILY_URL = './levels_daily.json';
const EPOCH = [2027, 0, 1];
const pad = (n) => String(n).padStart(2, '0');

/** §5 정본: 로컬 자정 기준 2027-01-01부터 일수 → 음수 안전 mod 366. → { i, ymd, days } */
export function dayIndex(d = new Date()) {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());          // 로컬 자정
  const days = Math.round((local - new Date(EPOCH[0], EPOCH[1], EPOCH[2])) / 864e5);   // DST 23/25h 흡수
  const i = ((days % 366) + 366) % 366;
  return { i: i === 0 ? 0 : i, days, ymd: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}

/** 'YYYY-MM-DD' → 'M/D'(라벨용) */
export function mdOf(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  return m ? `${+m[2]}/${+m[3]}` : '';
}

/** 오늘(ymd) 기록 | null — 날짜가 바뀐 기록은 무시(다음 저장 때 교체) */
export function todayRecord(ymd = dayIndex().ymd) {
  let d = null;
  try { d = store.loadDaily(); } catch (e) { d = null; }
  return d && d.ymd === ymd ? d : null;
}

/** 데일리 클리어 → hanbut:daily 갱신(오늘 기록보다 좋을 때만: 별↑ 또는 같은 별·u↓) + result 페이로드.
 *  본편 진행(progress·log·streak·maxClearedLevel)은 건드리지 않는다. */
export function recordDaily(meta, lv, s, u, hintUsed, streak = 0) {
  const prev = todayRecord(meta.ymd);
  const better = !prev || s > prev.stars || (s === prev.stars && u < prev.u);
  if (better) {
    try { store.saveDaily({ v: 1, i: meta.i, ymd: meta.ymd, stars: s, u }); } catch (e) { /* 저장 실패는 결과만 표시 */ }
  }
  return { L: 0, daily: true, i: meta.i, ymd: meta.ymd, w: lv.w, h: lv.h, stars: s, u, streak, hintUsed,
    best: better ? s : prev.stars, pauseCard: false, packEnd: false };
}

// ── 지연 로드(첫 진입 때 1회, 실패는 캐시하지 않음 → 다음 탭에 재시도) ──
let cache = null;
export function getDailyLevels(url = DAILY_URL, loader = loadLevels) {
  if (!cache) {
    cache = Promise.resolve(loader(url, 'daily'))
      .then(r => r || { ok: false, error: 'loadError', id: null })
      .catch(() => ({ ok: false, error: 'loadError', id: null }))
      .then(r => { if (!r.ok) cache = null; return r; });
  }
  return cache;
}
export function resetDailyCache() { cache = null; }

// ── 로비 버튼 #btn-daily ──
const $ = (id) => document.getElementById(id);
let busy = false;
let deps = { dispatch: () => false, showError: () => {}, hideError: () => {} };

export function initDaily(opts) {
  deps = { ...deps, ...opts };
  const b = $('btn-daily');
  if (b) b.addEventListener('click', () => { playDaily(); });
  renderDaily();
}

/** 오늘 레벨 로드 → enterDaily. 실패 시 lobby-msg(loadError / dataError{id}). */
export async function playDaily() {
  if (busy) return false;
  busy = true;
  const b = $('btn-daily');
  if (b) b.setAttribute('aria-busy', 'true');
  try {
    const r = await getDailyLevels();
    if (!r.ok) {
      if (r.error === 'dataError' && r.id) deps.showError('dataError', { id: r.id }); else deps.showError('loadError');
      return false;
    }
    const d = dayIndex();
    const level = (r.levels || []).find(x => x && x.i === d.i) || null;
    if (!level) { deps.showError('dataError', { id: `D${d.i}` }); return false; }
    deps.hideError();
    return deps.dispatch({ type: 'enterDaily', level, i: d.i, ymd: d.ymd });
  } finally {
    busy = false;
    if (b) b.removeAttribute('aria-busy');
  }
}

/** 로비 렌더: 이름 + 오늘 완료 시 '오늘 완료' 캡션·★ */
export function renderDaily() {
  const b = $('btn-daily');
  if (!b) return;
  const name = b.querySelector('.daily-name'), stat = b.querySelector('.daily-stat');
  const rec = todayRecord();
  if (name) setText(name, 'daily');
  b.classList.toggle('is-done', !!rec);
  if (stat) {
    stat.hidden = !rec;
    if (rec) setRaw(stat, `${fmt('dailyDone')} ${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)}`);
  }
}
