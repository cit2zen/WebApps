// HUD — 단계명, 하트, 점수, 타이머, 콤보/피버 게이지 (바뀐 값만 씀)
import { $, el, flash } from './dom.js';
import { stageInfo } from './strings.js';
import { FEVER_NEED, FEVER_TIME, multOf } from './scoring.js';
import { modeLabel } from './modes.js';

const cache = {};
function put(key, node, fn, val) {
  if (cache[key] === val) return;
  cache[key] = val;
  fn(node, val);
}
const setText = (n, v) => { n.textContent = v; };

export function resetHud() {
  for (const k of Object.keys(cache)) delete cache[k];
}

export function renderHud(S) {
  put('stage', $('#hud-stage'), setText, modeLabel(S, stageInfo(S.stage)));
  put('hearts', $('#hud-hearts'), (n, v) => {
    const [h, max] = v.split('/').map(Number);
    n.replaceChildren(...Array.from({ length: max }, (_, i) => el('span', { class: i < h ? '' : 'lost', text: '♥' })));
    n.setAttribute('aria-label', `하트 ${h}개`);
  }, `${S.hearts}/${S.maxHearts || 3}`);
  put('shield', $('#hud-shield'), (n, v) => { n.hidden = !v; }, S.shield > 0);
  put('score', $('#hud-score'), setText, String(S.score));

  if (S.timeMax) {
    const left = Math.max(0, S.timeLeft);
    put('time', $('#hud-time'), setText, `${Math.ceil(left)}초`);
    put('timer', $('#hud-timer'), (n, v) => { n.style.transform = `scaleX(${v})`; }, Math.min(1, left / S.timeMax).toFixed(3));
    put('low', $('#hud-timer').parentElement, (n, v) => n.classList.toggle('is-low', v), left <= 10);
  } else if (S.review) {
    const R = S.review;
    const left = R.pending.length + S.ents.filter((e) => !e.gone && e.kind === 'item').length;
    put('time', $('#hud-time'), setText, `남은 카드 ${left}`);
    put('low', $('#hud-timer').parentElement, (n, v) => n.classList.toggle('is-low', v), false);
    put('timer', $('#hud-timer'), (n, v) => { n.style.transform = `scaleX(${v})`; }, (R.total ? 1 - Math.min(R.total, left) / R.total : 1).toFixed(3));
  } else {
    put('time', $('#hud-time'), setText, '∞');
    put('timer', $('#hud-timer'), (n, v) => { n.style.transform = `scaleX(${v})`; }, '1');
    put('low', $('#hud-timer').parentElement, (n, v) => n.classList.toggle('is-low', v), false);
  }

  const fever = S.feverLeft > 0;
  put('fever', $('#play'), (n, v) => n.classList.toggle('is-fever', v), fever);
  const fill = fever ? S.feverLeft / FEVER_TIME : S.gauge / FEVER_NEED;
  put('gauge', $('#hud-fever'), (n, v) => { n.style.width = `${v}%`; }, (fill * 100).toFixed(1));
  const label = fever ? 'FEVER! ×2' : S.combo >= 2 ? `콤보 ${S.combo} ×${multOf(S.combo)}` : '콤보';
  put('combo', $('#hud-combo'), setText, label);
}

export const popScore = () => flash($('#hud-score'), 'pop');
export const popHearts = () => flash($('#hud-hearts'), 'pop');
