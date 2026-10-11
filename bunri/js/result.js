// 결과 화면 — 모드별 머리(단계·무한·오늘의 도전·복습), 점수, 별, 통계, 새 스티커, 자랑하기, 다시 볼 카드
import { $, el, reducedMotion } from './dom.js';
import { binById } from './data.js';
import { store } from './storage.js';
import { stageInfo } from './strings.js';
import { prepList, binChip, binVar } from './explain.js';
import { countUp, confetti } from './fx.js';
import { sfx } from './audio.js';
import { lastRunMeta } from './meta.js';
import { stickerById } from './stickers.js';
import { stickerFace } from './stickerbook.js';
import { shareResult } from './share.js';

let current = null;

function itemCard(item) {
  const bin = binById(item.bin);
  return el('article', { class: 'mini-card', style: binVar(item.bin) }, [
    el('div', { class: 'mini-emoji', 'aria-hidden': 'true', text: item.emoji || '❔' }),
    el('div', { class: 'mini-body' }, [
      el('p', { class: 'mini-name', text: item.name }),
      item.state ? el('span', { class: 'tag', text: `🏷️ ${item.state}` }) : null,
      bin ? binChip(bin) : null,
      item.why ? el('p', { class: 'mini-why', text: item.why }) : null,
      prepList(item.prep),
    ]),
  ]);
}

function quizCard(q) {
  return el('article', { class: 'mini-card', style: '--c:var(--sun)' }, [
    el('div', { class: 'mini-emoji mini-ox', 'aria-hidden': 'true', text: q.answer ? 'O' : 'X' }),
    el('div', { class: 'mini-body' }, [
      el('p', { class: 'mini-name', text: q.q }),
      el('span', { class: 'tag tag-ok', text: `정답: ${q.answer ? '⭕ 맞아요' : '❌ 아니에요'}` }),
      q.why ? el('p', { class: 'mini-why', text: q.why }) : null,
    ]),
  ]);
}

function renderStars(n, show) {
  const box = $('#res-stars');
  box.hidden = !show;
  box.setAttribute('aria-label', `별 ${n}개`);
  box.replaceChildren(...[0, 1, 2].map((i) => el('span', { class: i < n ? 'on' : '', style: `--i:${i}`, 'aria-hidden': 'true', text: '★' })));
}

const stat = (label, value) => el('li', {}, [el('b', { text: value }), label]);
const pct = (r) => `${Math.round((r.accuracy || 0) * 100)}%`;
const num = (n) => (Number(n) || 0).toLocaleString('ko-KR');

/** 모드별 머리말·통계 — { badge, cls, emoji, title, stars, best, stats, cheer } */
function headOf(r, meta) {
  if (r.mode === 'daily') {
    const d = meta.daily || { best: r.score, streak: 1, isBest: false, mod: (r.daily && r.daily.mod) || {} };
    const mod = d.mod || {};
    return {
      badge: '오늘의 도전', cls: ' is-daily', emoji: mod.icon || '📅', stars: false, best: d.isBest, cheer: d.isBest,
      title: `${mod.icon || ''} ${mod.name || '오늘의 규칙'} 도전 끝!`.trim(),
      stats: [stat('정답', String(r.correct)), stat('오늘 최고', `${num(d.best)}점`), stat('연속 도전', `🔥 ${d.streak}일`)],
    };
  }
  if (r.mode === 'review') {
    return {
      badge: '복습', cls: ' is-review', emoji: '📝', stars: false, best: false, cheer: meta.graduated > 0,
      title: '복습 완료!',
      stats: [stat('졸업한 카드', `🎓 ${meta.graduated}장`), stat('남은 카드', `${meta.left}장`), stat('정확도', pct(r))],
    };
  }
  const isBest = store.record(r.stage, r.score, r.stars);
  return {
    badge: r.endless ? '무한 도전' : r.success ? 'CLEAR!' : '실패',
    cls: r.endless ? ' is-endless' : r.success ? '' : ' is-fail',
    emoji: r.endless ? '🏅' : r.success ? '🏆' : '🌱',
    title: r.endless ? `정답 ${r.correct}개까지 버텼어요!`
      : r.success ? `${r.stage}단계 ${stageInfo(r.stage).name} 성공!` : '아쉬워요, 다시 해 봐요!',
    stars: !r.endless, best: isBest, cheer: r.success || (r.endless && isBest),
    stats: [stat('정답', String(r.correct)), stat('최고 콤보', String(r.maxCombo)), stat('정확도', pct(r))],
  };
}

/** 새 스티커 — 결과가 뜬 뒤 한 장씩 붙음 */
function renderNewStickers(ids) {
  const list = ids.map(stickerById).filter(Boolean);
  const box = $('#res-new');
  box.hidden = list.length === 0;
  $('#res-new-list').replaceChildren(...list.map((s, i) => el('div', { class: 'res-new-item' }, [
    stickerFace(s, true, { fresh: true, i }),
    el('span', { class: 'stk-name', text: s.name }),
  ])));
  if (list.length) setTimeout(() => sfx('sticker'), reducedMotion() ? 0 : 900);
}

function renderButtons(r, meta) {
  const isStage = r.mode === 'stage' || (!r.mode && !r.endless);
  const nextStage = r.stage + 1;
  const hasNext = isStage && nextStage <= 4 && store.isUnlocked(nextStage);
  $('#btn-next').hidden = !hasNext;
  $('#btn-next').textContent = nextStage === 4 ? '무한 도전' : '다음 단계';
  const noReview = r.mode === 'review' && meta.left === 0;
  $('#btn-retry').hidden = noReview;
  $('#btn-retry').textContent = r.mode === 'review' ? '한 번 더 복습' : '다시하기';
  return hasNext;
}

function renderReview(mistakes) {
  const seen = new Set();
  const uniq = (mistakes || []).filter((m) => {
    const key = m.kind === 'item' ? 'i:' + m.item.id : 'q:' + (m.q && m.q.q);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  $('#res-review').hidden = uniq.length === 0;
  $('#res-list').replaceChildren(...uniq.map((m) => (m.kind === 'item' ? itemCard(m.item) : quizCard(m.q))));
}

/** r = run:end 결과 객체 · 반환: 다음 단계 열림 여부 */
export function renderResult(r) {
  current = r;
  const meta = lastRunMeta();
  const h = headOf(r, meta);
  const badge = $('#res-badge');
  badge.textContent = h.badge;
  badge.className = 'res-badge' + h.cls;
  const emo = $('#res-emoji');
  if (!emo.firstElementChild) emo.textContent = h.emoji; // 마스코트가 들어 있으면 그대로 둠
  $('#res-title').textContent = h.title;
  renderStars(r.stars || 0, h.stars);
  $('#res-score').textContent = '0';
  countUp($('#res-score'), r.score);
  $('#res-best').hidden = !h.best;
  $('#res-stats').replaceChildren(...h.stats);
  if (h.cheer) requestAnimationFrame(() => confetti());
  renderNewStickers(meta.stickers || []);
  renderReview(r.mistakes);
  return renderButtons(r, meta);
}

$('#btn-share').addEventListener('click', () => { if (current) shareResult(current, lastRunMeta()); });
