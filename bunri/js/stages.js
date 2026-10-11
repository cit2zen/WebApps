// 단계 선택 — 티켓 카드 4장(무한 도전 포함), 잠금·별·최고 점수
import { $, el } from './dom.js';
import { binsForStage } from './data.js';
import { store } from './storage.js';
import { STAGES, starText } from './strings.js';
import { binVar } from './explain.js';

function ticket(s, onPick) {
  const unlocked = store.isUnlocked(s.n);
  const bins = binsForStage(s.n);
  const best = store.best(s.n);
  const lockHint = s.endless ? '3단계를 깨면 열려요.' : '앞 단계를 깨면 열려요.';
  return el('button', {
    class: 'ticket' + (s.endless ? ' is-endless' : '') + (unlocked ? '' : ' is-locked'),
    type: 'button',
    disabled: !unlocked,
    'aria-label': `${s.endless ? '' : s.n + '단계 '}${s.name}${unlocked ? '' : ' (잠김)'}`,
    on: { click: () => unlocked && onPick(s.n) },
  }, [
    el('span', { class: 'ticket-num', 'aria-hidden': 'true', text: unlocked ? (s.endless ? '∞' : String(s.n)) : '🔒' }),
    el('span', { class: 'ticket-name', text: s.name }),
    el('span', { class: 'ticket-desc', text: unlocked ? `${s.desc} (수거함 ${bins.length}개)` : lockHint }),
    el('span', { class: 'ticket-foot' }, [
      el('span', { class: 'ticket-dots', 'aria-hidden': 'true' }, bins.map((b) => el('span', { class: 'dot', style: binVar(b.id), title: b.name }))),
      s.endless ? null : el('span', { class: 'ticket-stars', 'aria-label': `별 ${store.stars(s.n)}개`, text: starText(store.stars(s.n)) }),
      el('span', { class: 'ticket-best', text: best ? `최고 ${best}점` : '기록 없음' }),
    ]),
  ]);
}

export function renderStages(onPick) {
  $('#stage-list').replaceChildren(...STAGES.map((s) => ticket(s, onPick)));
}
