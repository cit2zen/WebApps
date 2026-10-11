// 도감 — 검색(사용자 입력은 textContent로만 출력)·수거함 필터·규칙·출처
import { $, el } from './dom.js';
import { bins, items, sources, binById } from './data.js';
import { store } from './storage.js';
import { prepList, binChip, binVar } from './explain.js';
import { isReviewItem, reviewCount } from './meta.js';

let filter = 'all';
const search = $('#dex-search');

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

function matches(it, q) {
  if (filter === 'review') { if (!isReviewItem(it.id)) return false; }
  else if (filter !== 'all' && it.bin !== filter) return false;
  if (!q) return true;
  const bin = binById(it.bin) || {};
  return [it.name, it.state, bin.name, bin.full].some((f) => norm(f).includes(q));
}

function itemCard(it) {
  const bin = binById(it.bin);
  const seen = store.isSeen(it.id);
  const missed = isReviewItem(it.id);
  return el('article', { class: 'dex-item' + (seen ? ' is-seen' : '') + (missed ? ' is-missed' : ''), style: binVar(it.bin) }, [
    seen ? el('span', { class: 'seen-badge', title: '발견', 'aria-label': '발견', text: '✓' }) : null,
    el('span', { class: 'dex-emoji', 'aria-hidden': 'true', text: it.emoji || '❔' }),
    el('p', { class: 'dex-name', text: it.name }),
    it.state ? el('span', { class: 'tag', text: `🏷️ ${it.state}` }) : null,
    missed ? el('span', { class: 'tag tag-coral', text: '📝 헷갈려요' }) : null,
    it.trap && !missed ? el('span', { class: 'tag trap-tag', text: '⚠️ 함정 카드' }) : null,
    bin ? binChip(bin) : null,
    prepList(it.prep, '버리기 전에'),
    it.why ? el('p', { class: 'mini-why', text: it.why }) : null,
  ]);
}

function renderList() {
  const q = norm(search.value);
  const list = items.filter((it) => matches(it, q));
  $('#dex-list').replaceChildren(...list.map(itemCard));
  $('#dex-empty').hidden = list.length > 0;
}

function renderChips() {
  const n = reviewCount();
  if (filter === 'review' && !n) filter = 'all';
  const all = [{ id: 'all', label: '전체' }, ...(n ? [{ id: 'review', label: `📝 헷갈린 카드 ${n}` }] : []),
    ...bins.map((b) => ({ id: b.id, label: `${b.emoji} ${b.name}` }))];
  $('#dex-chips').replaceChildren(...all.map((c) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(filter === c.id), text: c.label,
    style: c.id === 'all' ? null : c.id === 'review' ? '--c:var(--coral)' : binVar(c.id),
    on: { click: () => { filter = c.id; renderChips(); renderList(); } },
  })));
}

function renderStatic() {
  $('#dex-rules').replaceChildren(...bins.map((b) => el('li', { class: 'rule-row', style: binVar(b.id) }, [
    el('span', { class: 'rule-dot', 'aria-hidden': 'true', text: b.emoji }),
    el('span', { class: 'rule-body' }, [el('b', { text: b.full }), el('span', { text: b.rule || '' })]),
  ])));
  $('#dex-sources').replaceChildren(...sources.map((s) => el('li', {}, el('a', {
    href: s.url, target: '_blank', rel: 'noopener', text: s.title || s.url,
  }))));
}

export function renderDex() {
  const seen = store.seenCount(items.map((it) => it.id));
  $('#dex-count').textContent = `발견 ${seen} / ${items.length}`;
  $('#dex-bar').style.width = `${items.length ? (seen / items.length) * 100 : 0}%`;
  renderChips();
  renderStatic();
  renderList();
}

search.addEventListener('input', renderList);
