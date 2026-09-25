// store.js — localStorage 4키(hanbut:progress·log·settings·daily) 읽기/쓰기 (§6 저장 표)
// 전부 JSON 문자열. 읽기는 safeGet(key, validate, def): 파싱 실패·v 불일치·타입 검증 실패 → 기본값으로 덮어쓰기.
// localStorage 접근 자체가 throw(프라이빗 모드)하면 메모리 폴백 + console.warn 1회.

export const KEYS = {
  progress: 'hanbut:progress',
  log: 'hanbut:log',
  settings: 'hanbut:settings',
  daily: 'hanbut:daily',
};
export const LOG_MAX = 500;

const mem = new Map();
let warned = false;
function fallback(err) {
  if (!warned) { warned = true; console.warn('[hanbut] localStorage unavailable — memory fallback', err && err.message); }
}
function rawGet(key) {
  try { return globalThis.localStorage.getItem(key); }
  catch (e) { fallback(e); return mem.has(key) ? mem.get(key) : null; }
}
function rawSet(key, str) {
  try { globalThis.localStorage.setItem(key, str); }
  catch (e) { fallback(e); mem.set(key, str); }
}
function rawDel(key) {
  try { globalThis.localStorage.removeItem(key); }
  catch (e) { fallback(e); }
  mem.delete(key);
}

const isInt = (x, min = 0) => Number.isInteger(x) && x >= min;
const clone = (o) => JSON.parse(JSON.stringify(o));

// 기본값 팩토리(매번 새 객체 — 호출자가 변경해도 기본값 오염 없음)
export const defaultProgress = () => ({ v: 1, maxClearedLevel: 0, stars: [0], streak: 0, bestStreak: 0 });
export const defaultSettings = () => ({ sound: true, vibrate: true });

export function validProgress(p) {
  return !!p && typeof p === 'object' && p.v === 1
    && isInt(p.maxClearedLevel) && isInt(p.streak) && isInt(p.bestStreak)
    && Array.isArray(p.stars) && p.stars.length >= 1
    && p.stars.every(x => Number.isInteger(x) && x >= 0 && x <= 3);
}
export function validSettings(s) {
  return !!s && typeof s === 'object' && typeof s.sound === 'boolean' && typeof s.vibrate === 'boolean';
}
function validLogEntry(e) {
  return !!e && typeof e === 'object' && isInt(e.L, 1) && isInt(e.t) && isInt(e.u)
    && Number.isInteger(e.stars) && e.stars >= 1 && e.stars <= 3;
}
export function validLog(a) { return Array.isArray(a) && a.every(validLogEntry); }
export function validDaily(d) {
  return !!d && typeof d === 'object' && d.v === 1 && Number.isInteger(d.i) && d.i >= 0 && d.i <= 365
    && typeof d.ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.ymd)
    && Number.isInteger(d.stars) && d.stars >= 1 && d.stars <= 3 && isInt(d.u);
}

// def: 값 또는 () => 값. 키 없음 → 기본값 반환(저장 안 함). 손상 → 기본값으로 덮어쓰고 반환.
export function safeGet(key, validate, def) {
  const mk = () => (typeof def === 'function' ? def() : clone(def));
  const raw = rawGet(key);
  if (raw === null || raw === undefined) return mk();
  let val;
  try { val = JSON.parse(raw); } catch { val = undefined; }
  if (val !== undefined && validate(val)) return val;
  const d = mk();
  if (d === null) rawDel(key); else rawSet(key, JSON.stringify(d));
  return d;
}

export function safeSet(key, val) {
  try { rawSet(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('[hanbut] save failed', key, e && e.message); return false; }
}

// ── progress ──
export function loadProgress() { return safeGet(KEYS.progress, validProgress, defaultProgress); }
export function saveProgress(p) {
  if (!validProgress(p)) { console.warn('[hanbut] saveProgress: invalid schema — ignored'); return false; }
  return safeSet(KEYS.progress, p);
}

// ── settings (§4: 키 없음·파싱 실패 시 기본값으로 저장 후 사용) ──
export function loadSettings() {
  const s = safeGet(KEYS.settings, validSettings, defaultSettings);
  if (rawGet(KEYS.settings) === null) safeSet(KEYS.settings, s);
  return s;
}
export function saveSettings(s) {
  if (!validSettings(s)) return false;
  return safeSet(KEYS.settings, { sound: s.sound, vibrate: s.vibrate });
}

// ── log (≤ 500 순환, 초과 시 앞에서 제거) ──
export function loadLog() { return safeGet(KEYS.log, validLog, () => []); }
export function appendLog(entry) {
  if (!validLogEntry(entry)) return false;
  const log = loadLog();
  log.push({ L: entry.L, t: entry.t, u: entry.u, stars: entry.stars });
  while (log.length > LOG_MAX) log.shift();
  return safeSet(KEYS.log, log);
}
export function dumpLog() { return JSON.stringify(loadLog()); }

// ── daily (포스트MVP) ──
export function loadDaily() { return safeGet(KEYS.daily, validDaily, () => null); }
export function saveDaily(d) { return validDaily(d) ? safeSet(KEYS.daily, d) : false; }

// 진행 초기화: progress·log·daily 삭제, settings 유지(§4·§6). 로비 재렌더는 lobby.wipe()가 담당.
export function wipe() {
  rawDel(KEYS.progress);
  rawDel(KEYS.log);
  rawDel(KEYS.daily);
}
