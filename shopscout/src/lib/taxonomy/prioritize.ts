import { z } from 'zod';
import type { LlmClient } from '@/lib/llm/client';
import type { PurchaseIntent } from '@/lib/types';
import type { ResolvedRubric } from './types';

const schema = z.object({
  weights: z.array(z.object({ key: z.string(), importance: z.number().min(0).max(1) })).default([]),
  note: z.string().default(''),
});

export interface PrioritizedRubric {
  rubric: ResolvedRubric;
  note: string; // 어떤 기준을 왜 우선했는지 짧은 설명
}

export function hashIntent(intent: PurchaseIntent): string {
  return [
    intent.useCase ?? '',
    ...intent.mustHaves,
    ...intent.dealbreakers,
    ...(intent.priorityHints ?? []),
    intent.budgetKRW?.max ?? '',
  ]
    .join('|')
    .slice(0, 120);
}

const cache = new Map<string, PrioritizedRubric>();

/**
 * 사용자 목적에 따라 카테고리 평가 기준의 가중치를 재조정한다.
 * 같은 (카테고리 + 목적)에 대해 1회 호출 후 캐시.
 * 실패 시 원본 루브릭을 그대로 반환(가중치 변경 없음).
 */
export async function prioritizeRubric(
  llm: LlmClient,
  rubric: ResolvedRubric,
  intent: PurchaseIntent,
): Promise<PrioritizedRubric> {
  if (rubric.criteria.length === 0) return { rubric, note: '' };
  // 캐시 키에 nodeName(동적 루브릭의 품목명)과 기준 key 집합을 포함해
  // 같은 nodeId('general')·같은 슬롯의 서로 다른 품목 간 가중치 캐시 충돌을 막는다.
  const critKey = rubric.criteria.map((c) => c.key).sort().join(',');
  const cacheKey = `${rubric.nodeId}::${rubric.nodeName}::${critKey}::${hashIntent(intent)}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const list = rubric.criteria.map((c) => `${c.key} — ${c.label} (기본가중치 ${c.weight})`).join('\n');
  const system = `너는 구매 컨설턴트다. 주어진 평가 기준들 중 "이 사용자의 구매 목적과 명시한 우선순위"에서 더 중요한 기준에 높은 importance(0~1)를 매겨라.
- 목적과 무관한 기준은 낮게, 목적 달성에 직결되는 기준은 높게.
- 사용자가 priorityHints로 우선순위를 직접 말했다면(예: "가격보다 내구성 우선") 그것을 최우선으로 반영하라.
- 모든 기준의 key에 대해 importance를 매긴다. note에 무엇을 왜 우선했는지 1문장(한국어).
- 예: 1인가구 냉장고면 용량보다 에너지효율·소음을, 대가족이면 용량을; 다이어트 식품이면 영양/칼로리를, 맛 우선이면 후기/원산지를.`;

  try {
    const r = await llm.structured({
      key: `prioritize:${cacheKey}`,
      system,
      prompt: `평가 기준:\n${list}\n\n구매 목적:\n${JSON.stringify(intent)}`,
      schema,
    });
    // 오직 LLM importance(0~1 상대중요도)만 정규화에 쓴다. 모델이 누락한 key의 fallback은
    // 절대 가중치 c.weight(부서별 2~5 정수 스케일)가 아니라 같은 0~1 스케일의 작은 상수다.
    // (이질 스케일을 섞어 정규화하면 사용자가 우선한 기준이 오히려 최저 가중치가 되는 역전 발생.)
    // key 매칭은 trim/소문자로 흡수해 모델의 사소한 철자/대소문자 변형을 살린다.
    const impMap = new Map(r.weights.map((w) => [w.key.trim().toLowerCase(), w.importance]));
    const matched = rubric.criteria.filter((c) => impMap.has(c.key.trim().toLowerCase()));
    // 매칭된 key가 하나도 없으면(환각/완전 오타) 원본 루브릭을 그대로 둔다(catch 경로와 동일).
    if (matched.length === 0) {
      const passthrough: PrioritizedRubric = { rubric, note: r.note ?? '' };
      cache.set(cacheKey, passthrough);
      return passthrough;
    }
    const FALLBACK_IMP = 0.1; // 모델이 언급 안 한 기준: 명시 우선순위 아래에 위치
    const raw = rubric.criteria.map((c) => ({
      c,
      imp: impMap.get(c.key.trim().toLowerCase()) ?? FALLBACK_IMP,
    }));
    const total = raw.reduce((a, x) => a + x.imp, 0);
    // 모든 importance가 0이면(LLM이 전부 0/누락) 평탄화하지 말고 원본 유지.
    if (total <= 0) {
      const passthrough: PrioritizedRubric = { rubric, note: r.note ?? '' };
      cache.set(cacheKey, passthrough);
      return passthrough;
    }
    const criteria = raw.map(({ c, imp }) => ({ ...c, weight: Math.round((imp / total) * 100) / 100 }));
    const result: PrioritizedRubric = {
      rubric: { ...rubric, criteria },
      note: r.note ?? '',
    };
    cache.set(cacheKey, result);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string); // 엔트리 상한
    return result;
  } catch {
    return { rubric, note: '' };
  }
}

export function clearPriorityCache(): void {
  cache.clear();
}
