// 로비 아래쪽 — 칭호, 오늘의 도전 알약, 복습 알약, 스티커 개수 (로비에 들어올 때마다 다시 그림)
import { $, el } from './dom.js';
import { on } from './events.js';
import { dailyState, reviewCount, stickerState } from './meta.js';

const num = (n) => (Number(n) || 0).toLocaleString('ko-KR');

function renderDaily() {
  const d = dailyState();
  const btn = $('#btn-daily');
  const { mod } = d.spec;
  btn.classList.toggle('is-locked', !d.unlocked);
  btn.setAttribute('aria-label', d.unlocked
    ? `오늘의 도전, 오늘의 규칙 ${mod.name}, 최고 ${d.best}점, ${d.streak}일 연속`
    : '오늘의 도전 (잠김) — 1단계를 깨면 열려요');
  const sub = d.unlocked
    ? [d.best ? `최고 ${num(d.best)}점` : '오늘 첫 도전!', d.streak ? `🔥 ${d.streak}일` : null].filter(Boolean).join(' · ')
    : '🔒 1단계를 깨면 열려요';
  btn.replaceChildren(
    el('span', { class: 'pb-main' }, [
      el('span', { text: '📅 오늘의 도전' }),
      el('span', { class: 'pb-mod', text: `${mod.icon} ${mod.name}` }),
    ]),
    el('span', { class: 'pb-sub', text: sub }),
  );
}

export function renderLobbyMeta() {
  renderDaily();
  const n = reviewCount();
  $('#btn-review').hidden = n === 0;
  $('#review-n').textContent = String(n);
  $('#btn-review').setAttribute('aria-label', `헷갈린 카드 복습 ${n}장`);
  const st = stickerState();
  $('#stk-n').textContent = `${st.count}/${st.total}`;
  $('#btn-stickers').setAttribute('aria-label', `스티커북, ${st.count}개 모음`);
  $('#btn-title').textContent = `${st.title.icon} ${st.title.name}`;
  $('#btn-title').setAttribute('aria-label', `내 칭호 ${st.title.name} — 스티커북 열기`);
}

on('screen', ({ name }) => { if (name === 'lobby') renderLobbyMeta(); });
