// 공유 상태 — 현재 판(G.S), 화면 훅, 수거함 버튼
import { dialogOpen } from './sheet.js';
import { emit } from './events.js';

export const G = { S: null, hooks: {}, binEls: [] };

/** 일시정지 이유: count · coach · bonus · sheet · menu · end */
export function pause(why) {
  const S = G.S;
  if (!S || S.pause.has(why)) return;
  S.pause.add(why);
  emit('pause', { why });
}
export function unpause(why) {
  const S = G.S;
  if (!S || !S.pause.delete(why)) return;
  emit('unpause', { why });
}
export const isRunning = () => !!G.S && !G.S.over && G.S.pause.size === 0;

/** 카드·수거함 입력 가능 — 코치 중에는 허용 */
export function canInput() {
  const S = G.S;
  if (!S || S.over || dialogOpen()) return false;
  for (const p of S.pause) if (p !== 'coach') return false;
  return true;
}

export const binElOf = (id) => G.binEls.find((b) => b.dataset.bin === id) || null;

export function centerOf(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top };
}
