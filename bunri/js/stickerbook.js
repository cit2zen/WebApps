// 스티커북 화면 + 스티커 한 장(다이컷 비닐 스티커 모양) — 결과 화면 '새 스티커!'도 같은 모양을 씀
import { $, el } from './dom.js';
import { openDialog } from './sheet.js';
import { sfx } from './audio.js';
import { STICKERS, tiltOf } from './stickers.js';
import { stickerState } from './meta.js';

/** 스티커 한 장 — opts.fresh: 붙는 애니메이션, opts.i: 순서(지연) */
export function stickerFace(s, unlocked, opts = {}) {
  return el('span', {
    class: 'stk' + (unlocked ? '' : ' is-locked') + (opts.fresh ? ' is-fresh' : ''),
    style: `--c:${s.c};--r:${tiltOf(s.id)}deg;--i:${opts.i || 0}`,
    'aria-hidden': 'true',
  }, [
    el('span', { class: 'stk-face' }, el('span', { class: 'stk-emoji', text: unlocked ? s.emoji : '?' })),
  ]);
}

function openDetail(s, unlocked, date) {
  sfx('tap');
  openDialog([
    el('div', { class: 'stk-detail' }, stickerFace(s, unlocked)),
    el('h2', { class: 'sheet-title', text: unlocked ? s.name : '아직 비밀이에요' }),
    el('p', { class: 'sheet-why', text: s.desc }),
    el('span', { class: 'tag' + (unlocked ? ' tag-ok' : ''), text: unlocked ? (date ? `🏅 ${date}에 붙였어요` : '🏅 붙였어요') :'🔒 아직 잠겨 있어요' }),
  ], [{ label: '닫기', value: true, primary: true }], { dismiss: true, label: s.name });
}

function cell(s, owned) {
  const unlocked = !!owned[s.id];
  return el('button', {
    class: 'stk-cell' + (unlocked ? '' : ' is-locked'),
    type: 'button',
    'aria-label': unlocked ? `${s.name} 스티커 — ${s.desc}` : `잠긴 스티커 — ${s.desc}`,
    on: { click: () => openDetail(s, unlocked, owned[s.id]) },
  }, [
    stickerFace(s, unlocked),
    el('span', { class: 'stk-name', text: unlocked ? s.name : s.desc }),
  ]);
}

export function renderStickers() {
  const { owned, count, total, title } = stickerState();
  $('#stk-title').textContent = `${title.icon} ${title.name}`;
  $('#stk-count').textContent = `모은 스티커 ${count} / ${total}`;
  $('#stk-bar').style.width = `${total ? (count / total) * 100 : 0}%`;
  $('#stk-grid').replaceChildren(...STICKERS.map((s) => cell(s, owned)));
}
