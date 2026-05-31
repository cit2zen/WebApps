import { z } from 'zod';
import type { LlmClient } from '@/lib/llm/client';
import type { CriterionDef } from './types';

const criterionSchema = z.object({
  key: z.string(),
  label: z.string(),
  check: z.string(),
  dataNeeded: z.array(z.string()).default([]),
  weight: z.number().min(0).max(1).default(0.2),
  redFlags: z.array(z.string()).default([]),
});
const schema = z.object({ criteria: z.array(criterionSchema) });

// 품목 키별 1회 생성 후 재사용 (롱테일 비용 절감)
const cache = new Map<string, CriterionDef[]>();

/**
 * FNV-1a 32비트 해시. 전체 문자열을 반영해 충돌 위험을 낮춘다.
 * (이전 구현은 공백 제거 + 60자 truncate라 서로 다른 긴 품목명이 같은 키로 충돌)
 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5; // offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32비트 곱셈(FNV prime 0x01000193)을 오버플로 없이 수행
    h = Math.imul(h, 0x01000193);
  }
  // 부호 없는 32비트 → 8자리 16진수 문자열
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * 캐시/Mock 키. 정규화한 품목명 전체를 해시하므로
 * 같은 품목명 → 같은 키, 다른 품목명 → (사실상) 다른 키.
 */
export function rubricCacheKey(s: string): string {
  const norm = s.toLowerCase().replace(/\s+/g, '');
  return fnv1a(norm);
}

/**
 * 택소노미에 없는 품목의 평가 기준을 LLM으로 생성하고 캐시한다.
 * 부서 기본 기준(base) 위에 품목 특화 기준을 더하는 용도.
 */
export async function generateRubric(
  llm: LlmClient,
  itemName: string,
): Promise<CriterionDef[]> {
  // 빈/공백 품목명은 fnv1a('') 단일 키로 모든 롱테일 품목을 한 캐시 엔트리에 충돌시키고
  // 실 LLM에 빈 '품목: ' 프롬프트를 보내 쓰레기 기준을 만든다 — 조기 차단(자체감사 A5/A11).
  if (!itemName || !itemName.trim()) return [];
  const key = rubricCacheKey(itemName);
  const hit = cache.get(key);
  if (hit) {
    // LRU 갱신: 최근 사용으로 이동
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const system = `너는 온라인 쇼핑 평가 기준 설계자다. 주어진 구체 품목에 대해 "온라인 구매 의사결정"에 중요한 평가 기준 4~6개를 만든다.
- 품목 특수 요소를 반드시 반영(식품→영양·알레르겐·유통기한, 전자→스펙·호환·A/S, 의류→원단·핏, 의약/건강→성분·함량·주의 등).
- 각 기준: key(영문snake), label(한글), check(평가자 지시 한국어), dataNeeded(필요 스크랩 필드 한국어), weight(0~1), redFlags(위험신호 한국어).
- 건강 관련은 정보 제공이며 의학적 조언이 아님을 전제로 객관 기준만.`;

  try {
    const r = await llm.structured({
      key: `rubric:${key}`,
      system,
      prompt: `품목: ${itemName}`,
      schema,
    });
    // 필수 텍스트 필드가 빈 기준은 버린다(z.string()은 빈 문자열도 통과시키므로 평가에 무용).
    const criteria = (r.criteria ?? []).filter(
      (c): c is CriterionDef => !!c?.key && !!c?.label && !!c?.check,
    ) as CriterionDef[];
    // 빈/불량 결과는 캐시하지 않는다 — 같은 품목명이 영구히 빈 기준으로 고착되는 캐시 오염 방지(다음 턴 재시도 허용).
    if (criteria.length === 0) return [];
    cache.set(key, criteria);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string); // 최대 엔트리 상한(LRU 제거)
    return criteria;
  } catch (err) {
    // 동적 생성 실패를 조용히 삼키지 않고 가시화한다(롱테일 품목이 품목특화 기준 없이 추천되는 상황 관측).
    console.warn(`[taxonomy] generateRubric 실패 "${itemName}":`, (err as Error)?.message ?? err);
    return [];
  }
}

/** 테스트용 캐시 초기화 */
export function clearRubricCache(): void {
  cache.clear();
}
