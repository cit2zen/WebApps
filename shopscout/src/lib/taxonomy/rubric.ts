import type { LlmClient } from '@/lib/llm/client';
import type { PurchaseIntent } from '@/lib/types';
import type { CriterionDef, ResolvedRubric, Taxonomy } from './types';
import { resolveRubric } from './resolver';
import { classifyCategory } from './classify';
import { generateRubric } from './dynamic';

/** 동적 생성 신뢰도 임계값. 이 값 미만이면 분류기가 확신하지 못한 것으로 본다. */
const CONFIDENCE_THRESHOLD = 0.5;

/**
 * 택소노미에 적합한 노드가 없거나 base 기준이 비었을 때 사용할 최소 공통 기준.
 * ⓕ(최종 평가)가 항상 평가할 거리를 갖도록 보장한다.
 */
export const GENERAL_FALLBACK: CriterionDef[] = [
  { key: 'value', label: '가성비', check: '가격 대비 가치가 합리적인가?', dataNeeded: ['가격'], weight: 0.4, redFlags: ['과도한 가격'] },
  { key: 'trust', label: '신뢰', check: '판매자/브랜드/리뷰가 믿을 만한가?', dataNeeded: ['리뷰', '판매자'], weight: 0.3, redFlags: ['저신뢰 판매자', '리뷰 조작 의심'] },
  { key: 'fitness', label: '목적적합', check: '구매 목적·용도에 부합하는가?', dataNeeded: ['사양', '용도'], weight: 0.3, redFlags: ['용도 불일치'] },
];

/**
 * 동적 생성이 필요한지 판단한다.
 * - nodeId가 'general'이거나(택소노미에 적합 노드 없음)
 * - 분류 신뢰도가 임계값 미만이면(분류기가 확신 못 함) 동적 생성.
 * 분류기가 실제 부서/리프 노드를 confidence>=임계값으로 골랐으면 상속 기준을 그대로 쓴다.
 */
function needsDynamic(nodeId: string, confidence: number): boolean {
  return nodeId === 'general' || confidence < CONFIDENCE_THRESHOLD;
}

function mergeCriteria(base: CriterionDef[], extra: CriterionDef[]): CriterionDef[] {
  const map = new Map<string, CriterionDef>();
  for (const c of base) map.set(c.key, c);
  for (const c of extra) if (!map.has(c.key)) map.set(c.key, c);
  return [...map.values()];
}

/** 사용자가 대화로 추가한 평가 특성(extraCriteria)을 CriterionDef로 변환 */
function userCriteria(intent: PurchaseIntent): CriterionDef[] {
  // key는 내용 기반(인덱스 X) — 순서가 바뀌어도 같은 특성은 같은 key라 중복 병합되지 않음
  return (intent.extraCriteria ?? []).map((c) => ({
    key: `user_${c.replace(/\s+/g, '').slice(0, 24)}`,
    label: c,
    check: `사용자가 추가로 중시하는 특성: "${c}". 이 매물이 이 점에서 적합한지 평가하라.`,
    dataNeeded: [c],
    weight: 0.25,
    redFlags: [],
  }));
}

/**
 * intent를 분류해 평가 루브릭을 해결한다.
 * - 구체 리프/부서로 확신 있게 분류되면 그 노드의 상속 병합 기준 사용(dynamic=false).
 * - general이거나 신뢰도가 낮으면(롱테일) 부서/폴백 기준 + LLM 동적 생성 품목 기준을 병합(dynamic=true).
 */
export async function resolveRubricForIntent(
  llm: LlmClient,
  tax: Taxonomy,
  intent: PurchaseIntent,
): Promise<ResolvedRubric> {
  const cls = await classifyCategory(llm, tax, intent);
  const base = resolveRubric(tax, cls.nodeId) ?? {
    nodeId: 'general',
    nodeName: '범용',
    criteria: [],
    scrapeHints: [],
    dynamic: false,
  };

  // base 기준이 비면(노드 없음/빈 기준) 최소 공통 기준으로 채운다.
  const baseCriteria = base.criteria.length > 0 ? base.criteria : GENERAL_FALLBACK;

  const extra = userCriteria(intent); // 사용자가 대화로 추가한 특성

  if (!needsDynamic(cls.nodeId, cls.confidence)) {
    // 확신 있는 부서/리프 — 상속 기준 + 사용자 추가 특성
    return {
      ...base,
      criteria: mergeCriteria(baseCriteria, extra),
      scrapeHints: [...base.scrapeHints, ...(intent.extraCriteria ?? [])],
    };
  }

  // 롱테일: 품목 특화 기준 동적 생성 + 사용자 추가 특성 병합
  const dynamicCriteria = await generateRubric(llm, cls.itemName);
  return {
    nodeId: base.nodeId,
    nodeName: cls.itemName || base.nodeName,
    criteria: mergeCriteria(mergeCriteria(baseCriteria, dynamicCriteria), extra),
    scrapeHints: [...base.scrapeHints, ...(intent.extraCriteria ?? [])],
    // 동적 기준이 실제로 생성됐을 때만 dynamic=true (생성 실패 시 범용 기준으로 폴백했음을 정확히 표시)
    dynamic: dynamicCriteria.length > 0,
  };
}
