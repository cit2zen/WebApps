// 벨트 위 카드(엔티티) — DOM 생성·위치·맨 앞 표시·퇴장 연출
import { el, flash, reducedMotion } from './dom.js';
import { actOf } from './data.js';
import { actFly } from './fx.js';

const box = () => document.getElementById('belt-items');
let seq = 0;

function itemCard(item, stage) {
  const act = actOf(item);
  return el('div', { class: 'belt-card' }, [
    el('span', { class: 'bc-emoji', 'aria-hidden': 'true', text: item.emoji || '❔' }),
    el('span', { class: 'bc-name', text: item.name }),
    item.state ? el('span', { class: 'bc-state', text: item.state }) : null,
    act ? el('span', { class: 'bc-act', text: stage === 1 ? `${act.icon} 톡! ${act.label}` : act.icon }) : null,
  ]);
}

function powerCard(p) {
  return el('div', { class: 'belt-card power-card' }, [
    el('span', { class: 'bc-emoji', 'aria-hidden': 'true', text: p.emoji }),
    el('span', { class: 'bc-name', text: '톡!' }),
  ]);
}

/** 분해 카드 — 점선 테두리 + "✂️ 분해!" 리본 + 부품 미리보기 */
function comboCard(c) {
  return el('div', { class: 'belt-card combo-card' }, [
    el('span', { class: 'bc-ribbon', text: '✂️ 분해!' }),
    el('span', { class: 'bc-emoji', 'aria-hidden': 'true', text: c.emoji || '📦' }),
    el('span', { class: 'bc-name', text: c.name }),
    el('span', { class: 'bc-parts', 'aria-hidden': 'true', text: c.parts.map((p) => p.emoji || '·').join(' ') }),
  ]);
}

const LABELS = {
  item: (d) => `${d.name}${d.state ? ', ' + d.state : ''}`,
  power: (d) => `황금 아이템 ${d.name} — 톡 눌러 모으기`,
  combo: (d) => `분해 카드 ${d.name} — 톡 눌러 나누기`,
};

/** kind: 'item' | 'power' | 'combo' · 반환한 엔티티는 아직 벨트에 붙지 않음 */
export function makeEntity(kind, data, stage) {
  const card = kind === 'item' ? itemCard(data, stage) : kind === 'combo' ? comboCard(data) : powerCard(data);
  const cls = 'belt-item' + (kind === 'power' ? ' is-power' : kind === 'combo' ? ' is-combo' : '');
  const node = el('div', { class: cls, 'aria-label': LABELS[kind](data), role: 'img' }, card);
  return {
    id: ++seq, kind, node, card,
    item: kind === 'item' ? data : null,
    power: kind === 'power' ? data : null,
    combo: kind === 'combo' ? data : null,
    x: 0, w: 100, dx: 0, dy: 0,
    held: false, gone: false, actDone: false, hinted: false,
  };
}

export function attach(ent, x) {
  box().append(ent.node);
  ent.w = ent.node.offsetWidth || 100;
  ent.x = x;
  place(ent);
}

export function place(ent) {
  ent.node.style.transform = `translate3d(${(ent.x + ent.dx).toFixed(1)}px, ${ent.dy.toFixed(1)}px, 0)`;
}

export const beltWidth = () => box().clientWidth;

export function setActive(prev, next) {
  if (prev) prev.node.classList.remove('is-active');
  if (next) next.node.classList.add('is-active');
}

function removeLater(node, ms) {
  if (reducedMotion()) { node.remove(); return; }
  setTimeout(() => node.remove(), ms);
}

/** how: 'fly'(수거함으로) · 'fall'(구덩이로) · 'poof' */
export function removeEntity(ent, how, target) {
  ent.gone = true;
  ent.node.classList.remove('is-active');
  if (how === 'fly' && target) {
    const c = ent.node.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const tx = ent.x + ent.dx + (t.left + t.width / 2) - (c.left + c.width / 2);
    const ty = ent.dy + (t.top + t.height / 3) - (c.top + c.height / 2);
    ent.node.classList.add('is-fly');
    ent.node.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(0.2) rotate(${tx > 0 ? 20 : -20}deg)`;
    removeLater(ent.node, 340);
  } else {
    ent.node.classList.add(how === 'fall' ? 'is-fall' : 'is-poof');
    removeLater(ent.node, how === 'fall' ? 620 : 320);
  }
}

/** 손질 완료 — 말풍선이 ✓ 칩으로 */
export function markActDone(ent, act) {
  ent.actDone = true;
  const bubble = ent.card.querySelector('.bc-act');
  if (bubble) {
    const r = bubble.getBoundingClientRect();
    actFly(r.left, r.top, act.icon);
    bubble.textContent = `✓ ${act.done || '손질 완료'}`;
    bubble.classList.add('is-done');
  }
  flash(ent.node, 'is-tap');
}

export function clearBelt() { box().replaceChildren(); }
