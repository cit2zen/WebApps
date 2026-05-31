import type { LlmClient } from '@/lib/llm/client';
import {
  totalPrice,
  type Evaluation,
  type FactorCode,
  type FactorResult,
  type Listing,
  type PurchaseIntent,
} from '@/lib/types';
import { mergedEvalSchema, type FactorSchema, type MergedEval } from './types';
import { COMMON_GUARD, FACTOR_PROMPTS } from './prompts';
import { deterministicDealbreakers, mustHaveLiteralStatus } from './specMatch';
import { aggregateCategory } from './category';
import { aggregateTrust } from './score';
import { sanitize } from '@/lib/util/sanitize';
import type { ResolvedRubric } from '@/lib/taxonomy/types';

type StandardCode = Exclude<FactorCode, 'f'>;
const CODES: StandardCode[] = ['a', 'b', 'c', 'd', 'e'];

export interface PriceContext {
  min: number;
  p25: number;
  median: number;
  sampleSize: number;
}

/** 같은 검색의 매물들로 가격 분포(시세 기준선)를 계산 — ⓒ 미끼가/비정상저가 판단용 */
export function computePriceContext(siblings: Listing[]): PriceContext | undefined {
  const prices = siblings
    .map(totalPrice)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  if (prices.length < 2) return undefined;
  // 선형보간 백분위 (q*(n-1)) — 짝수 표본에서 중앙 두 값 평균, p25가 min에 고정되지 않음
  const at = (q: number) => {
    const idx = q * (prices.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return prices[lo] + (prices[hi] - prices[lo]) * (idx - lo);
  };
  return {
    min: prices[0],
    p25: Math.round(at(0.25)),
    median: Math.round(at(0.5)),
    sampleSize: prices.length,
  };
}

function listingContext(
  l: Listing,
  priceContext?: PriceContext,
  specMatchHint?: { met: string[]; unmet: string[] },
): string {
  const data = {
    title: sanitize(l.title),
    marketplace: l.marketplace,
    priceKRW: l.priceKRW,
    shippingKRW: l.shippingKRW,
    seller: l.seller ? sanitize(l.seller, 100) : undefined,
    rating: l.rating,
    reviewCount: l.reviewCount,
    ratingHistogram: l.ratingHistogram,
    reviews: (l.reviews ?? []).slice(0, 8).map((r) => ({
      text: sanitize(r.text, 200),
      rating: r.rating,
      date: r.date,
      hasPhoto: r.hasPhoto,
    })),
    images: l.images.slice(0, 5),
    specs: l.rawSpecs,
    searchRank: l.searchRank,
    isSponsored: l.isSponsored,
    adLabel: l.adLabel,
    priceContext,
    specMatchHint, // 결정적 필수조건 리터럴 충족 힌트(ⓔ 참고용)
  };
  return `<listing_data>\n${JSON.stringify(data, null, 2)}\n</listing_data>`;
}

const FACTOR_LABEL: Record<StandardCode, string> = {
  a: '후기 진위',
  b: '사진·정품/사양',
  c: '가격·허위매물',
  d: '광고·협찬',
  e: '목적 적합성',
};

/** 6요소를 한 번에 평가하도록 지시하는 병합 시스템 프롬프트 (R8) */
function buildMergedSystem(rubric?: ResolvedRubric): string {
  const factorBlocks = CODES.map(
    (c) => `[요소 ${c}] ${FACTOR_LABEL[c]}\n${FACTOR_PROMPTS[c].system}`,
  ).join('\n\n');
  let categoryBlock = '';
  if (rubric && rubric.criteria.length > 0) {
    const criteria = rubric.criteria
      .map((cr) => `  - key=${cr.key} [${cr.label}] (가중치 ${cr.weight}) ${cr.check} | 위험신호: ${cr.redFlags.join(', ') || '없음'}`)
      .join('\n');
    categoryBlock = `\n\n[요소 f] 카테고리 전문 평가 — "${rubric.nodeName}". 아래 기준 각각을 채점해 f.criterionScores 배열에 {key,score,confidence,dataInsufficient,flags}로 반환:\n${criteria}`;
  }
  return (
    `너는 상품 종합 평가자다. 하나의 매물을 아래 여러 요소로 동시에 평가하고, 각 요소의 결과를 한 JSON으로 반환하라.\n` +
    `각 요소(a~e)는 {score(0~100), confidence(0~1), flags[], rationale, dataInsufficient}를 반환. 요소 e는 추가로 mustHaveMet/dealbreakerHit(boolean).\n` +
    `데이터가 없으면 점수를 지어내지 말고 confidence를 낮추고 dataInsufficient=true.\n\n` +
    `${factorBlocks}${categoryBlock}\n\n${COMMON_GUARD}`
  );
}

/** 점수를 0~100으로 강제(문자열/범위이탈 방어 — 스키마를 거치지 않는 경로 대비 이중 방어, bug4) */
function clampScore(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}
/** confidence를 0~1로 강제(퍼센트 85 → 0.85 정규화 포함) */
function normConfidence(v: unknown): number {
  let n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) n = n / 100;
  return Math.min(1, Math.max(0, n));
}

function toFactor(code: StandardCode, r: FactorSchema): FactorResult {
  const base: FactorResult = {
    code,
    score: clampScore(r.score),
    confidence: normConfidence(r.confidence),
    flags: Array.isArray(r.flags) ? r.flags : [],
    rationale: r.rationale ?? '',
    dataInsufficient: r.dataInsufficient,
  };
  // mustHaveMet/dealbreakerHit는 목적 적합성(ⓔ) 전용 — 모델이 다른 요소에 잘못 채워도 ⓔ 외에는 싣지 않는다.
  if (code === 'e') {
    base.mustHaveMet = r.mustHaveMet;
    base.dealbreakerHit = r.dealbreakerHit;
  }
  return base;
}

function infraFailFactor(code: FactorCode): FactorResult {
  return { code, score: 0, confidence: 0, flags: ['평가불가'], rationale: '평가 호출 실패', dataInsufficient: true, infraFailure: true };
}

export async function evaluateListing(
  llm: LlmClient,
  l: Listing,
  intent: PurchaseIntent,
  siblings: Listing[] = [l],
  rubric?: ResolvedRubric,
): Promise<Evaluation> {
  const priceContext = computePriceContext(siblings);
  const specMatchHint = mustHaveLiteralStatus(l, intent);
  const detDealbreakers = deterministicDealbreakers(l, intent);

  // R8: 6요소를 단일 LLM 호출로 평가(72→12콜). 이미지가 있으면 멀티모달로(ⓑ 사진 평가).
  const call = {
    key: `eval:${l.id}`,
    system: buildMergedSystem(rubric),
    prompt: `구매목적:\n${JSON.stringify(intent)}\n\n${listingContext(l, priceContext, specMatchHint)}`,
    schema: mergedEvalSchema,
  };
  let merged: MergedEval | null = null;
  try {
    const useImages = typeof llm.structuredWithImages === 'function' && l.images.length > 0;
    if (useImages) {
      // 이미지(ⓑ)는 부가 신호 — 멀티모달 호출이 실패해도(잘못된 이미지 URL/형식) 텍스트 전용으로 1회 폴백.
      // 이미지 메타 문제 하나로 6요소 평가 전체가 탈락하지 않게 한다(bug16).
      try {
        merged = await llm.structuredWithImages!(call, l.images);
      } catch {
        merged = await llm.structured(call);
      }
    } else {
      merged = await llm.structured(call);
    }
  } catch {
    merged = null; // 텍스트 경로마저 실패할 때만 인프라 실패로 본다
  }

  const factors: FactorResult[] = merged
    ? [
        // per-factor 격리: 한 요소가 누락돼도 그 요소만 infraFailFactor로 처리하고 나머지는 살린다(bug4)
        ...CODES.map((c) => {
          const fac = merged![c];
          return fac ? toFactor(c, fac) : infraFailFactor(c);
        }),
        // rubric이 있는데 모델이 f 블록을 누락하거나 빈 채점({}, criterionScores:[])을 주면
        // '0점 데이터부족'이 아니라 평가 실패로 처리(coverage 분모에서 빠져 카테고리 미평가 가시화, bug15)
        ...(rubric
          ? [
              (merged.f?.criterionScores?.length ?? 0) > 0
                ? aggregateCategory(rubric, merged.f!.criterionScores, merged.f!.rationale ?? '')
                : infraFailFactor('f'),
            ]
          : []),
      ]
    : [...CODES.map((c) => infraFailFactor(c)), ...(rubric ? [infraFailFactor('f')] : [])];

  // 결정적 배제조건 위반은 ⓔ 플래그로 가시화(하드 게이트에 반영)
  if (detDealbreakers.length > 0) {
    const e = factors.find((f) => f.code === 'e');
    if (e) e.flags = [...e.flags, ...detDealbreakers.map((d) => `금지조건:${d}`)];
  }

  // 종합·게이트는 score.ts로 분리(team.ts는 수집·맥락 구성에 집중).
  // 결정적 리터럴 미충족(specMatchHint.unmet)·필수조건 존재 여부를 게이트에 전달(bug14).
  const { trustScore, passesTrustThreshold } = aggregateTrust(
    factors,
    detDealbreakers,
    specMatchHint.unmet,
    (intent.mustHaves?.length ?? 0) > 0,
  );
  return { listingId: l.id, factors, trustScore, passesTrustThreshold };
}
