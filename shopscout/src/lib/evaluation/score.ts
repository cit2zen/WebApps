import type { FactorCode, FactorResult } from '@/lib/types';
import { RED_FLAG, TRUST_THRESHOLD } from './types';

/** 요소별 도메인 가중치 — 핵심 차별점(목적적합 ⓔ, 카테고리 ⓕ)을 높이고 광고청정도(ⓓ)는 낮춘다 */
export const DOMAIN_WEIGHT: Record<FactorCode, number> = { a: 1, b: 1, c: 1, d: 0.7, e: 1.3, f: 1.6 };

/** 가격 적정성(ⓒ) 통과 하한 */
export const PRICE_FLOOR = 30;

/**
 * 요소 결과들을 종합해 신뢰 점수와 통과 여부를 계산한다(결정적).
 * - 도메인 가중 평균 → 커버리지 패널티(인프라 실패 제외) → 하드 게이트(레드플래그·카테고리위험·배제조건·필수조건·가격하한).
 *
 * @param literalUnmet 리터럴 매칭으로 '미충족'으로 보이는 필수조건들(specMatch; 표현차로 오탐 가능 → 하드 차단엔 안 씀).
 * @param hasMustHaves 사용자가 필수조건을 명시했는지. 명시했는데 리터럴로도 확인 안 되고 ⓔ도 mustHaveMet=true를 못 주면 통과 금지.
 */
export function aggregateTrust(
  factors: FactorResult[],
  detDealbreakers: string[],
  literalUnmet: string[] = [],
  hasMustHaves = false,
): { trustScore: number; passesTrustThreshold: boolean } {
  const wsum = factors.reduce((a, f) => a + f.score * f.confidence * DOMAIN_WEIGHT[f.code], 0);
  const confWeight = factors.reduce((a, f) => a + f.confidence * DOMAIN_WEIGHT[f.code], 0);

  // 데이터 커버리지 — 인프라 실패 요소는 '매물의 데이터 문제'가 아니므로 분모에서 제외
  const evaluable = factors.filter((f) => !f.infraFailure);
  const covered = evaluable.filter((f) => !f.dataInsufficient && f.confidence > 0).length;
  const coverage = covered / Math.max(evaluable.length, 1);

  let trustScore: number;
  if (confWeight > 0) {
    trustScore = Math.round((wsum / confWeight) * (0.5 + 0.5 * coverage));
  } else if (evaluable.length === 0) {
    // 평가 가능한 요소가 전혀 없음(전부 인프라 실패) → 신뢰 0(이 경우만 진짜 '평가 불가').
    trustScore = 0;
  } else {
    // 평가는 됐으나 모든 요소가 데이터 부족(confidence≈0) → '신뢰 0(나쁨)'이 아니라 '근거 부족'.
    // 원점수 단순평균에 강한 커버리지 패널티(×0.5)를 적용해 표시는 살리되 게이트는 통과 못 하게 한다(bug30).
    const mean = evaluable.reduce((a, f) => a + f.score, 0) / evaluable.length;
    trustScore = Math.round(mean * 0.5);
  }

  const eFactor = factors.find((f) => f.code === 'e');
  const fFactor = factors.find((f) => f.code === 'f');
  const priceFactor = factors.find((f) => f.code === 'c');
  // RED_FLAG 하드 게이트는 통제 어휘를 쓰는 표준 요소(ⓐ~ⓔ)에만 적용
  const hasRedFlag = factors.some((f) => f.code !== 'f' && f.flags.some((fl) => RED_FLAG.test(fl)));
  const categoryRisk = fFactor?.flags.includes('카테고리위험') === true;
  const dealbreaker = eFactor?.dealbreakerHit === true || detDealbreakers.length > 0;
  // 필수조건 게이트(bug14): ⓔ가 '평가 가능'할 때만 적용한다. ⓔ가 인프라 실패/누락(infraFailure)이면
  // mustHaveMet=undefined인데, 이를 '미확인=차단'으로 보면 per-factor 격리(bug4) 의도가 깨져
  // 한 요소 누락이 매물 전체를 죽인다(자체감사 A1). 이 경우 리터럴 매칭에만 의존한다.
  // - 평가 가능한 ⓔ가 명시적으로 false → 차단
  // - 필수조건이 있는데 리터럴로도 전부 확인 안 되고, 평가 가능한 ⓔ도 true를 못 주면 차단
  // - 리터럴 전부 충족(unmet 없음)이면 통과(고정밀 긍정 신호)
  const eEvaluable = !!eFactor && !eFactor.infraFailure;
  const literalAllMet = hasMustHaves && literalUnmet.length === 0;
  const mustHaveUnmet =
    (eEvaluable && eFactor!.mustHaveMet === false) ||
    (hasMustHaves && !literalAllMet && eEvaluable && eFactor!.mustHaveMet !== true);

  const passesTrustThreshold =
    trustScore >= TRUST_THRESHOLD &&
    !hasRedFlag &&
    !categoryRisk &&
    !dealbreaker &&
    !mustHaveUnmet &&
    (priceFactor?.score ?? 0) >= PRICE_FLOOR;

  return { trustScore, passesTrustThreshold };
}
