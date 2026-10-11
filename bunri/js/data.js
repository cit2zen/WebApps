// items.js 검증·조회 — 잘못된 항목은 경고만 하고 건너뜀
import { BINS, ITEMS, QUIZ, SOURCES } from './items.js';
import { COMBOS } from './combos.js';

const arr = (v) => (Array.isArray(v) ? v : []);
const stageOf = (o) => Number(o && o.stage) || 1;

export const bins = arr(BINS).filter((b) => b && b.id);
const binMap = new Map(bins.map((b) => [b.id, b]));

export const items = arr(ITEMS).filter((it) => {
  if (!it || !it.id || !it.name) { console.warn('[bunri] 이름/id 없는 항목 건너뜀', it); return false; }
  const bin = binMap.get(it.bin);
  if (!bin) { console.warn(`[bunri] 알 수 없는 수거함 "${it.bin}" — ${it.id} 건너뜀`); return false; }
  if (stageOf(bin) > stageOf(it)) { console.warn(`[bunri] ${it.id}: 수거함 단계(${stageOf(bin)}) > 항목 단계(${stageOf(it)}) — 건너뜀`); return false; }
  return true;
});

export const quiz = arr(QUIZ).filter((q) => q && q.q && typeof q.answer === 'boolean');
export const sources = arr(SOURCES).filter((s) => s && s.url);

/** 손질 행동(act) — label이 있어야 유효 */
export const actOf = (it) => (it && it.act && typeof it.act.label === 'string' ? it.act : null);

export const binById = (id) => binMap.get(id);
export const binsForStage = (s) => bins.filter((b) => stageOf(b) <= s);
export { stageOf };

/** 분해 카드 — 부품마다 수거함이 있어야 하고 수거함 단계 ≤ 분해 카드 단계 */
export const combos = arr(COMBOS).filter((c) => {
  if (!c || !c.id || !c.name || !Array.isArray(c.parts) || c.parts.length < 2) { console.warn('[bunri] 분해 카드 형식 오류 — 건너뜀', c); return false; }
  for (const p of c.parts) {
    const bin = p && binMap.get(p.bin);
    if (!p || !p.id || !p.name || !bin) { console.warn(`[bunri] 분해 카드 ${c.id}: 부품 오류 — 건너뜀`, p); return false; }
    if (stageOf(bin) > stageOf(c)) { console.warn(`[bunri] 분해 카드 ${c.id}: ${p.id} 수거함 단계 > 카드 단계 — 건너뜀`); return false; }
  }
  return true;
});
