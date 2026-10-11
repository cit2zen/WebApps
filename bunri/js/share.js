// 자랑하기 — navigator.share, 없으면 클립보드 복사
import { toast } from './sheet.js';

const num = (n) => (Number(n) || 0).toLocaleString('ko-KR');

/** 결과(r) + 기록(meta) → 공유 문구 */
export function shareText(r, meta = {}) {
  const head = '♻️ 척척 분리수거';
  if (r.mode === 'review') return `📝 척척 분리수거 복습으로 헷갈린 카드 ${meta.graduated || 0}장을 졸업했어요! 나랑 분리수거 대결할래?`;
  if (r.mode === 'daily') {
    const mod = (meta.daily && meta.daily.mod) || {};
    const streak = meta.daily && meta.daily.streak > 1 ? ` 🔥 ${meta.daily.streak}일 연속!` : '';
    return `📅 척척 분리수거 오늘의 도전 ${mod.icon || ''} ${mod.name || ''} ${num(r.score)}점!${streak} 나랑 분리수거 대결할래?`.replace(/\s+/g, ' ');
  }
  if (r.endless) return `${head} 무한 도전 ${num(r.score)}점! 정답 ${r.correct}개까지 버텼어요. 나랑 분리수거 대결할래?`;
  if (r.success) return `${head} ${r.stage}단계 ${'★'.repeat(r.stars || 0)} ${num(r.score)}점! 나랑 분리수거 대결할래?`;
  return `${head} ${r.stage}단계 도전 중, ${num(r.score)}점! 나랑 분리수거 대결할래?`;
}

export async function shareResult(r, meta) {
  const text = shareText(r, meta);
  const url = location.origin + location.pathname;
  const data = { title: '척척 분리수거', text, url };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('복사했어요!');
  } catch {
    toast(['복사하지 못했어요.', text], 3000);
  }
}
