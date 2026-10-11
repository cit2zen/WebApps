// 첫 판 코치 — 손가락이 카드를 수거함으로 끌어 보여 줌
import { $ } from './dom.js';
import { centerOf } from './state.js';

let onGo = null;
$('#coach-go').addEventListener('click', () => { if (onGo) onGo(); });

export function showCoach(cardNode, binNode, go) {
  const coach = $('#coach');
  coach.hidden = false;
  const host = $('#play').getBoundingClientRect();
  const a = centerOf(cardNode);
  const b = centerOf(binNode);
  const hand = $('#coach-hand');
  hand.style.setProperty('--fx', `${a.x - host.left - 16}px`);
  hand.style.setProperty('--fy', `${a.y - host.top}px`);
  hand.style.setProperty('--tx', `${b.x - host.left - 16}px`);
  hand.style.setProperty('--ty', `${b.y - host.top}px`);
  onGo = go;
}

export function hideCoach() {
  $('#coach').hidden = true;
  onGo = null;
}
