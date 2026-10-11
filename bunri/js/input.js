// 입력 — 카드 끌기/톡, 수거함 버튼, 키보드, OX 버튼
import { $ } from './dom.js';
import { G, canInput } from './state.js';
import { makeDraggable } from './drag.js';
import { place } from './belt.js';
import { sortEntity, sortActive, doAct, collectPower } from './actions.js';
import { bonusAnswer, bonusOpen } from './bonus.js';
import { dialogOpen } from './sheet.js';
import { pauseMenu } from './play.js';

export const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'];

function release(ent, ok) {
  ent.held = false;
  ent.node.classList.remove('is-held');
  if (!ok && !ent.gone) { ent.dx = 0; ent.dy = 0; place(ent); }
}

export function wireEntity(ent) {
  makeDraggable(ent.node, {
    canTouch: () => canInput() && !ent.gone,
    canDrag: () => (ent.kind === 'item' || ent.kind === 'combo') && !ent.gone,
    onDragStart: () => { ent.held = true; ent.node.classList.add('is-held'); },
    onMove: (dx, dy) => { if (ent.gone) return; ent.dx = dx; ent.dy = dy; place(ent); },
    onDrop: (bin) => release(ent, sortEntity(ent, bin.dataset.bin)),
    onCancel: () => release(ent, false),
    onTap: () => (ent.kind === 'power' ? collectPower(ent) : doAct(ent)),
  });
}

/** OX 버튼·키 — 보너스 중에만 */
function answerOX(said) {
  const S = G.S;
  if (!S || dialogOpen() || !bonusOpen()) return;
  for (const p of S.pause) if (p !== 'bonus') return;
  bonusAnswer(said);
}

$('#btn-o').addEventListener('click', () => answerOX(true));
$('#btn-x').addEventListener('click', () => answerOX(false));
$('#btn-exit').addEventListener('click', () => pauseMenu());

document.addEventListener('keydown', (e) => {
  const S = G.S;
  if (!S || S.over || $('#play').hidden || dialogOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { e.preventDefault(); pauseMenu(); return; }
  if (e.code === 'KeyO') { e.preventDefault(); answerOX(true); return; }
  if (e.code === 'KeyX') { e.preventDefault(); answerOX(false); return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) doAct(S.active); return; }
  const idx = KEYS.indexOf(e.key);
  const bin = G.binEls[idx];
  if (idx >= 0 && bin && !bin.disabled) {
    e.preventDefault();
    if (!e.repeat) sortActive(bin.dataset.bin);
  }
});
