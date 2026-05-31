import { z } from 'zod';
import type { LlmClient } from '@/lib/llm/client';
import type { PurchaseIntent } from '@/lib/types';
import type { Taxonomy } from './types';
import { indexNodes } from './resolver';

const schema = z.object({
  nodeId: z.string(),
  itemName: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.5),
});

export interface Classification {
  nodeId: string; // 택소노미에 존재하는 id (없으면 'general'로 폴백됨)
  itemName: string;
  confidence: number;
}

/** intent를 택소노미 노드로 분류한다. 존재하지 않는 id를 받으면 'general'로 폴백. */
export async function classifyCategory(
  llm: LlmClient,
  tax: Taxonomy,
  intent: PurchaseIntent,
  cacheKey?: string,
): Promise<Classification> {
  const index = indexNodes(tax);
  if (index.size === 0) {
    return { nodeId: 'general', itemName: pickItemName('', intent), confidence: 0.3 };
  }

  const catalog = tax.nodes
    .map((n) => `${n.id} — ${n.name}${n.keywords.length ? ` (${n.keywords.slice(0, 6).join(',')})` : ''}`)
    .join('\n');

  const system = `너는 상품 분류기다. 아래 택소노미 노드 목록에서 구매 의도에 가장 잘 맞는 노드 id 하나를 고른다.
- 구체 품목 리프가 맞으면 그 리프 id를, 애매하면 가장 가까운 부서 id를, 전혀 안 맞으면 'general'을 반환.
- itemName에는 구체 품목명(예: '무선 기계식 키보드')을 적는다.
- nodeId는 반드시 목록에 있는 id 또는 'general'.`;

  const raw = await llm.structured({
    key: `classify:${cacheKey ?? intent.rawQuery}`,
    system,
    prompt: `택소노미 노드:\n${catalog}\n\n구매 의도:\n${JSON.stringify(intent)}`,
    schema,
  });

  const nodeId = index.has(raw.nodeId) ? raw.nodeId : 'general';
  return { nodeId, itemName: pickItemName(raw.itemName, intent), confidence: raw.confidence };
}

/**
 * 품목명 우선순위: 분류기 itemName → intent.category → (짧을 때만) rawQuery.
 * rawQuery가 긴 문장(예: "3일 안에 받을 가성비 좋은 거 추천해줘")이면 품목명으로 쓰지 않는다
 * — generateRubric/카테고리 평가 프롬프트와 캐시 키가 발화 문장으로 오염되는 것을 막는다.
 */
function pickItemName(rawItemName: string | undefined, intent: PurchaseIntent): string {
  const fromClassifier = (rawItemName ?? '').trim();
  if (fromClassifier) return fromClassifier;
  const cat = (intent.category ?? '').trim();
  if (cat) return cat;
  const raw = intent.rawQuery.trim();
  return raw.length <= 20 ? raw : '';
}
