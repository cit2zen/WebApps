// 설명 시트 내용 — 오답(항목/손질/OX)·도움말
import { el } from './dom.js';
import { openDialog } from './sheet.js';
import { josa, PRINCIPLES } from './strings.js';
import { binById } from './data.js';

export const binVar = (id) => `--c:var(--bin-${id})`;

export function binChip(bin) {
  return el('span', { class: 'bin-chip', style: binVar(bin.id), text: `${bin.emoji} ${bin.full}` });
}

export function prepList(prep, title = '버리기 전에') {
  if (!Array.isArray(prep) || !prep.length) return null;
  return el('div', { class: 'prep' }, [
    el('p', { class: 'prep-title', text: title }),
    el('ul', { class: 'prep-list' }, prep.map((p) => el('li', { text: p }))),
  ]);
}

const ok = [{ label: '알겠어요', value: 'ok', primary: true }];

/** 잘못된 수거함 — "{이름}은/는 → [수거함] 에 버려요" */
export function explainItem(item, bin) {
  const label = `앗, ${josa(item.name, '은/는')} ${bin.emoji} ${bin.full}에 버려요`;
  return openDialog([
    el('span', { class: 'sheet-badge', text: '앗!' }),
    el('div', { class: 'sheet-photo', 'aria-hidden': 'true', text: item.emoji || '❔' }),
    item.state ? el('p', { class: 'sheet-state', text: item.state }) : null,
    el('h2', { class: 'sheet-title' }, [`${josa(item.name, '은/는')} `, binChip(bin), '에 버려요']),
    item.why ? el('p', { class: 'sheet-why', text: item.why }) : null,
    prepList(item.prep),
  ], ok, { label });
}

/** 손질을 건너뛰고 맞는 수거함에 넣었을 때 */
export function explainPrep(item, bin, act) {
  const title = `앗, ${act.label}부터 해야 해요!`;
  return openDialog([
    el('span', { class: 'sheet-badge', text: `${act.icon || '✋'} 손질 먼저!` }),
    el('div', { class: 'sheet-photo', 'aria-hidden': 'true', text: item.emoji || '❔' }),
    item.state ? el('p', { class: 'sheet-state', text: item.state }) : null,
    el('h2', { class: 'sheet-title', text: title }),
    el('p', { class: 'sheet-why' }, ['카드를 톡 누르면 손질돼요. 그다음 ', binChip(bin), '에 넣어요.']),
    item.why ? el('p', { class: 'sheet-why', text: item.why }) : null,
    prepList(item.prep),
  ], ok, { label: title });
}

/** 분해 카드를 나누지 않고 넣었을 때 — 부품마다 수거함과 이유 */
export function explainCombo(combo) {
  const title = `앗, ${josa(combo.name, '은/는')} 분해해서 버려요`;
  return openDialog([
    el('span', { class: 'sheet-badge', text: '✂️ 분해 먼저!' }),
    el('div', { class: 'sheet-photo', 'aria-hidden': 'true', text: combo.emoji || '📦' }),
    el('h2', { class: 'sheet-title', text: title }),
    el('p', { class: 'sheet-why', text: '카드를 톡 누르면 부품 카드로 나뉘어요 (스페이스 키).' }),
    el('ul', { class: 'combo-parts' }, combo.parts.map((p) => el('li', {}, [
      el('span', { class: 'cp-name', text: `${p.emoji || ''} ${p.name} → ` }), binChip(binById(p.bin)),
      p.why ? el('span', { class: 'cp-why', text: p.why }) : null,
    ]))),
  ], ok, { label: title });
}

export function explainQuiz(q, timeout = false) {
  const title = `${timeout ? '시간 초과! ' : '앗, '}정답은 ${q.answer ? '⭕ (맞아요)' : '❌ (아니에요)'}`;
  return openDialog([
    el('span', { class: 'sheet-badge', text: timeout ? '⏰ 시간 끝' : '앗!' }),
    el('div', { class: 'sheet-photo sheet-ox', 'aria-hidden': 'true', text: q.answer ? 'O' : 'X' }),
    el('p', { class: 'sheet-state', text: q.q }),
    el('h2', { class: 'sheet-title', text: title }),
    q.why ? el('p', { class: 'sheet-why', text: q.why }) : null,
  ], ok, { label: title });
}

export function openHelp() {
  const steps = [
    '벨트를 타고 오는 쓰레기를 알맞은 수거함으로 끌어다 놓아요.',
    '수거함을 톡 누르면 맨 앞(노란 테두리) 카드가 들어가요. 키보드는 1–9, 0, - 키.',
    '🏷️ 말풍선이 있는 카드는 먼저 톡 눌러 손질해요 (스페이스 키).',
    '✂️ 분해 카드는 톡 눌러 부품으로 나눈 뒤 하나씩 버려요.',
    '틀리거나 벨트 끝에서 떨어뜨리면 하트가 줄어요. 틀리면 이유를 알려줘요.',
    '연속으로 맞히면 콤보! 게이지가 차면 FEVER로 점수 두 배.',
    '🔥 마지막 10초는 러시 타임! 벨트가 빨라지고 점수 ×1.5.',
    '⭐ 보너스 OX(O / X 키)와 황금 아이템(⏳ 💡 ❤️ 🛡️)도 챙겨요. 🛡️ 방패는 실수 한 번을 막아요.',
  ];
  return openDialog([
    el('span', { class: 'sheet-badge is-help', text: '도움말' }),
    el('h2', { class: 'sheet-title', text: '이렇게 놀아요' }),
    el('ol', { class: 'help-list' }, steps.map((s) => el('li', { text: s }))),
    el('h3', { class: 'help-sub', text: '분리배출 4대 원칙' }),
    el('div', { class: 'rules4' }, PRINCIPLES.map((p) => el('span', { class: 'r4' }, el('b', { text: p })))),
    el('p', { class: 'sheet-why', text: '비우고, 헹구고, 재질별로 나누고, 섞지 않으면 재활용이 훨씬 잘 돼요.' }),
  ], ok, { dismiss: 'ok', label: '도움말' });
}
