/* 공유 유틸 — settings.js / sets.js 공용 (먼저 로드) */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function imageUrl(path) { return path ? '/uploads/' + esc(path) : null; }

/* 성공/에러 공통 — 3초 후 자동 소멸 */
function showMsg(el, text) {
  el.textContent = text;
  clearTimeout(el._msgTimer);
  if (text) el._msgTimer = setTimeout(() => { el.textContent = ''; }, 3000);
}
