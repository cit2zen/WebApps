// share.js — 팩 공유(§9 g, 포스트MVP): navigator.share → clipboard.writeText 폴백 + 로비 토스트(#lobby-toast)
// 실패는 console.warn까지만(§8 콘솔 error 0). 토스트 수명은 main rAF dt(tick)로만 — setTimeout 없음.
import { fmt, setText } from './strings.js';

const TOAST_MS = 2000;
let toastLeft = 0;

/** 공유 텍스트: '한붓 팩 {k} {score}/30 ★ https://games.cityzen.kr/hanbut/' */
export function shareText(k, score) { return fmt('shareText', { k, score }); }

/** → 'shared' | 'copied' | 'failed'. env는 테스트 주입용({ navigator }). */
export async function sharePack(k, score, env = globalThis) {
  const text = shareText(k, score);
  const nav = env && env.navigator;
  if (nav && typeof nav.share === 'function') {
    try { await nav.share({ text }); return 'shared'; }
    catch (e) { console.warn('[hanbut] share unavailable — clipboard fallback', e && e.name); }
  }
  try {
    if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') throw new Error('no clipboard');
    await nav.clipboard.writeText(text);
    showToast('copied');
    return 'copied';
  } catch (e) {
    console.warn('[hanbut] clipboard failed', e && e.message);
    showToast('shareFail');
    return 'failed';
  }
}

/** 완료 팩 카드용 공유 버튼 — 카드 탭(펼침)·Enter로 전파되지 않게 차단 */
export function shareBtn(k, score) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pack-share t-caption';
  setText(b, 'share');
  b.setAttribute('aria-label', fmt('shareAria', { k }));
  for (const ev of ['pointerdown', 'keydown']) b.addEventListener(ev, (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); sharePack(k, score); });
  return b;
}

export function showToast(key) {
  const t = typeof document !== 'undefined' && document.getElementById('lobby-toast');
  if (!t) return;
  setText(t, key);
  t.hidden = false;
  toastLeft = TOAST_MS;
}

/** main.js frame(dt)에서 호출 */
export function tick(dt) {
  if (toastLeft <= 0) return;
  toastLeft -= dt;
  if (toastLeft <= 0) {
    const t = document.getElementById('lobby-toast');
    if (t) t.hidden = true;
  }
}
