// 기록·스티커 — 이벤트로 통계를 모으고 스티커를 엶 (events.js 구독, 게임 중에는 저장·알림 없음)
// 저장 키(store.get/set): stats · stickers {id:날짜} · review {id:{n,ok}} · daily {key,best,streak,last}
import { on } from './events.js';
import { store } from './storage.js';
import { items } from './data.js';
import { sfx } from './audio.js';
import { toast } from './sheet.js';
import { todayKey, dailySpec } from './daily.js';
import { STICKERS, newStickers, stickerById, titleFor } from './stickers.js';
import { reviewMiss, reviewHit, reviewPick, dailyNext, dailyView } from './metalogic.js';

const ITEM_IDS = new Set(items.map((it) => it.id));
const COUNTERS = ['acts', 'bonusOk', 'splits', 'golden', 'fevers'];

let mode = 'stage';
let run = null;        // 판마다 새로: 카운터 + 복습 목록 작업본
let last = { stickers: [], graduated: 0, left: 0, daily: null };

const statsOf = () => ({
  runs: 0, acts: 0, bonusOk: 0, splits: 0, golden: 0, fevers: 0, graduates: 0, maxCombo: 0, dailyTop: 0,
  ...store.get('stats', {}),
});
const ownedOf = () => ({ ...store.get('stickers', {}) });
const reviewOf = () => ({ ...store.get('review', {}) });

/** 스티커 판정용 통계 — 결과(r)를 아직 저장 전이어도 반영 */
function contextOf(stats, r) {
  const stars = { 1: store.stars(1), 2: store.stars(2), 3: store.stars(3) };
  if (r && r.mode === 'stage' && stars[r.stage] !== undefined) stars[r.stage] = Math.max(stars[r.stage], r.stars || 0);
  const endlessBest = Math.max(store.best(4), r && r.mode === 'endless' ? r.score : 0);
  const view = dailyView(store.get('daily', null), todayKey());
  return {
    ...stats, stars, endlessBest, streak: view.streak,
    seen: store.seenCount([...ITEM_IDS]), total: ITEM_IDS.size,
  };
}

function unlock(ids) {
  if (!ids.length) return;
  const owned = ownedOf();
  const day = todayKey();
  for (const id of ids) owned[id] = day;
  store.set('stickers', owned);
}

/** 판 카운터를 평생 통계에 더하고 복습 목록 저장 */
function flush(extra = {}) {
  if (!run) return statsOf();
  const stats = statsOf();
  for (const k of COUNTERS) { stats[k] += run[k]; run[k] = 0; } // 두 번 더하지 않게 비움
  stats.graduates += run.graduated;
  run.graduated = 0;
  Object.assign(stats, extra);
  store.set('stats', stats);
  store.set('review', run.review);
  return stats;
}

on('run:start', (d) => {
  mode = d.mode || (d.stage >= 4 ? 'endless' : 'stage');
  last = { stickers: [], graduated: 0, left: 0, daily: null };
  run = { acts: 0, bonusOk: 0, splits: 0, golden: 0, fevers: 0, graduated: 0, maxCombo: 0, review: reviewOf() };
});

on('correct', (d) => {
  if (!run) return;
  run.maxCombo = Math.max(run.maxCombo, Number(d.combo) || 0);
  const id = d.item && d.item.id;
  if (!id || !run.review[id]) return;
  const res = reviewHit(run.review, id, mode);
  run.review = res.list;
  if (res.graduated) {
    run.graduated++;
    if (mode === 'review') sfx('graduate');
  }
});

const onMistake = (d) => {
  const id = d.item && d.item.id;
  if (run && id && ITEM_IDS.has(id)) run.review = reviewMiss(run.review, id);
};
on('wrong', onMistake);
on('miss', onMistake);
on('act', () => { if (run) run.acts++; });
on('bonus', (d) => { if (run && d.ok) run.bonusOk++; });
on('split', () => { if (run) run.splits++; });
on('power', () => { if (run) run.golden++; });
on('fever', (d) => { if (run && d.on) run.fevers++; });

on('run:end', (r) => {
  if (!run) return;
  const prev = statsOf();
  const maxCombo = Math.max(run.maxCombo, Number(r.maxCombo) || 0);
  const extra = { runs: prev.runs + 1, maxCombo: Math.max(prev.maxCombo, maxCombo) };
  let daily = null;
  if (r.mode === 'daily') {
    const spec = r.daily || dailySpec(r.dailyKey || todayKey());
    const res = dailyNext(store.get('daily', null), spec.key || todayKey(), Number(r.score) || 0);
    store.set('daily', res.rec);
    extra.dailyTop = Math.max(prev.dailyTop, res.rec.best);
    daily = { best: res.rec.best, streak: res.rec.streak, isBest: res.isBest, mod: spec.mod };
  }
  const graduated = run.graduated;
  const runCtx = { ...r, fevers: run.fevers, maxCombo };
  const stats = flush(extra);
  const ids = newStickers(contextOf(stats, r), runCtx, ownedOf());
  unlock(ids);
  last = { stickers: ids, graduated, left: Object.keys(run.review).filter((id) => ITEM_IDS.has(id)).length, daily };
  run = null;
});

on('run:exit', () => { flush(); run = null; });

// 도감 스티커는 로비·도감에 들어올 때도 확인 (게임 중이 아니므로 토스트로 알림)
on('screen', ({ name }) => {
  if (run || (name !== 'lobby' && name !== 'dex')) return;
  const ids = newStickers(contextOf(statsOf(), null), null, ownedOf());
  if (!ids.length) return;
  unlock(ids);
  const s = stickerById(ids[0]);
  sfx('sticker');
  toast([`새 스티커! ${s.emoji} ${s.name}`, '스티커북에서 볼 수 있어요.'], 2200);
});

/** 방금 끝난 판의 기록 — 결과 화면이 씀 */
export const lastRunMeta = () => last;

export const reviewCount = () => Object.keys(store.get('review', {})).filter((id) => ITEM_IDS.has(id)).length;
export const reviewIds = (max = 12) => reviewPick(store.get('review', {}), max, ITEM_IDS);
export const isReviewItem = (id) => !!store.get('review', {})[id];

export function dailyState() {
  const spec = dailySpec();
  return { spec, ...dailyView(store.get('daily', null), spec.key), unlocked: store.stars(1) > 0 };
}

export function stickerState() {
  const owned = store.get('stickers', {});
  const count = STICKERS.filter((s) => owned[s.id]).length;
  return { owned, count, total: STICKERS.length, title: titleFor(count) };
}

// 탭을 닫아도 판 도중 기록은 남김
window.addEventListener('pagehide', () => { if (run) flush(); });
