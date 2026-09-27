// share.js — 공유 텍스트(규칙 19) 순수 함수 + shareFlow(native → clipboard → S10a 폴백) (§6)
// DOM에 접근하지 않는다(Node 테스트가 그대로 import). URL은 숫자만으로 조립한다(§6 보안 규칙).
import S from './strings.js';

export const SHARE_URL = 'https://games.cityzen.kr/doltap/';
const EMO = { P: '🟨', S: '🟫', X: '💥', E: '⬜' };
const sub = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

// grid 24자(P/S/X/E) → 6칸 × 4행 이모지. 모자라거나 모르는 글자는 ⬜
export function gridRows(grid) {
  const cells = [...String(grid || '')].slice(0, 24).map(ch => EMO[ch] || EMO.E);
  while (cells.length < 24) cells.push(EMO.E);
  return [0, 1, 2, 3].map(r => cells.slice(r * 6, r * 6 + 6).join(''));
}

// run: {H, left, grid, c?} · set: {day, n} · mode: 'official'|'practice'|'random'
// streak·tries: 공식 판 6행 값(doltap:v1 streak, days[day].tries)
export function buildShareText({ run, set, mode, streak = 1, tries = 1 }) {
  const H = run.H.toFixed(1), left = run.left;
  const c = Number.isInteger(run.c) ? run.c : Math.round(run.H * 10);
  const official = mode === 'official';
  const lines = [official ? sub(S.share.head, { n: set.n, H, left }) : sub(S.share.headPractice, { H, left })];
  lines.push(...gridRows(run.grid));
  if (official) lines.push(sub(S.share.streak, { s: streak, k: tries }));
  const dayOk = /^\d{8}$/.test(String(set.day)) && c >= 0 && c <= 99990;
  lines.push(mode === 'random' || !dayOk ? SHARE_URL : `${SHARE_URL}?d=${set.day}&c=${c}`);
  return lines.join('\n');
}

// native → clipboard → 'fallback'(호출자가 S10a를 연다). force가 있으면 그 경로만 시도한다(__doltap.forceShare)
export async function shareFlow(text, { force = null, nav = globalThis.navigator } = {}) {
  if ((!force || force === 'native') && nav && typeof nav.share === 'function') {
    try { await nav.share({ text }); return 'native'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  }
  if ((!force || force === 'clipboard') && nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    try { await nav.clipboard.writeText(text); return 'clipboard'; }
    catch (e) { /* 권한 거부·인앱 제한 → 폴백 */ }
  }
  return 'fallback';
}
