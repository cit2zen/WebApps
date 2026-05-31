import { z } from 'zod';
import type { LlmClient } from '@/lib/llm/client';
import { emptyIntent, type PurchaseIntent } from '@/lib/types';

export const REQUIRED_SLOTS = ['useCase', 'budgetKRW', 'mustHaves'] as const;

const schema = z.object({
  category: z.string().optional(),
  useCase: z.string().optional(),
  budgetKRW: z
    .object({ min: z.number().optional(), max: z.number().optional() })
    .optional(),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  dealbreakers: z.array(z.string()).default([]),
  mustHavesConfirmed: z.boolean().optional(),
  maxDeliveryDays: z.number().optional(),
  extraCriteria: z.array(z.string()).default([]),
  priorityHints: z.array(z.string()).default([]),
});

const SYSTEM = `너는 노련한 쇼핑 상담가다. 사용자 발화에서 구매 "목적"과 제약을 추출한다.
규칙:
- 제품명만으로 용도를 추론하지 마라. 명시되지 않은 useCase/budgetKRW/mustHaves는 비워둔다.
- budgetKRW는 원 단위 숫자. "10만원"은 {max:100000}.
- mustHaves는 사용자가 명시한 필수 조건만.
- 사용자가 필수조건이 없다고 답하면(예: "없음", "상관없음", "딱히 없어") mustHavesConfirmed=true 로 표시.
- 배송 기한이 언급되면(예: "3일 안에", "이번 주까지") maxDeliveryDays에 일수로 적는다.
- 사용자가 "~도 봐줘", "~도 중요해"처럼 평가할 특성을 추가하면 extraCriteria에 그 특성(예: "배터리 수명","방수","친환경 인증")을 넣는다.
- 사용자가 우선순위를 말하면(예: "가격보다 내구성이 더 중요", "디자인 최우선") priorityHints에 그대로 넣는다.`;

/** 핵심 슬롯이 의미 있게 채워졌는지 검사. budgetKRW는 빈 객체 {} 를 '미충족'으로 본다. */
export function computeMissingSlots(intent: PurchaseIntent): string[] {
  return REQUIRED_SLOTS.filter((s) => {
    if (s === 'budgetKRW') {
      // 양수 min 또는 max가 있어야 유효 예산. {max:0} 같은 비정상값은 미충족으로 보고 되묻는다.
      const b = intent.budgetKRW;
      return !usableBudget(b?.min) && !usableBudget(b?.max);
    }
    if (s === 'mustHaves') {
      // 빈 배열이지만 "없음"을 확인했으면 더 묻지 않는다(무한 루프 방지)
      return intent.mustHaves.length === 0 && !intent.mustHavesConfirmed;
    }
    const v = (intent as unknown as Record<string, unknown>)[s];
    return v == null || (Array.isArray(v) && v.length === 0);
  });
}

const SLOT_LABEL: Record<string, string> = {
  useCase: '용도',
  budgetKRW: '예산',
  mustHaves: '필수조건',
};

export interface DiscoverOptions {
  /** 직전 턴에서 사용자에게 물었던 슬롯(되묻기 답변을 그 슬롯으로 해석하도록 컨텍스트 제공) */
  askedSlot?: string;
  /** 누적된 직전 intent(원 제품 질의 등 맥락 유지) */
  prev?: PurchaseIntent;
}

export async function discoverIntent(
  llm: LlmClient,
  key: string,
  utterance: string,
  opts: DiscoverOptions = {},
): Promise<PurchaseIntent> {
  // 멀티턴 되묻기: 직전에 물은 슬롯이 있으면, 짧은 답변을 그 슬롯으로 해석하도록 프롬프트를 고정한다.
  // (단독 발화는 SYSTEM의 '추론 금지'를 유지하지만, 질문에 대한 답은 해당 슬롯으로 명시 해석)
  let prompt = utterance;
  if (opts.askedSlot) {
    const slotLabel = SLOT_LABEL[opts.askedSlot] ?? opts.askedSlot;
    const ctx = opts.prev?.rawQuery ? `\n참고: 사용자가 찾는 제품은 "${opts.prev.rawQuery}".` : '';
    // 조건부 해석: 답이 물은 슬롯에 대한 것이면 그 슬롯으로 채우되, 사용자가 실제로는 다른 슬롯
    // (예산/필수조건)을 답했으면 물은 슬롯은 비우고 답한 슬롯을 채운다. '비워두지 마라'식 강제는
    // 부분 응답을 엉뚱한 슬롯으로 욱여넣게 만들어 제거(자체감사 A7).
    prompt =
      `직전에 사용자에게 '${slotLabel}'을(를) 물었다. 아래 답이 그 슬롯(${opts.askedSlot})에 대한 답이면 해당 슬롯으로 해석해 채워라. ` +
      `그러나 답이 그 슬롯과 무관하고 실제로는 다른 슬롯(예: 예산/필수조건)을 답한 것이면, 물었던 슬롯은 비워두고 사용자가 실제로 답한 슬롯을 채워라.${ctx}\n답변: ${utterance}`;
  }
  const raw = await llm.structured({
    key: `purpose:${key}`,
    system: SYSTEM,
    prompt,
    schema,
  });
  const intent: PurchaseIntent = { ...emptyIntent(utterance), ...raw, missingSlots: [] };
  intent.missingSlots = computeMissingSlots(intent);
  return intent;
}

/**
 * 이전(누적) intent와 새 발화에서 추출한 intent를 병합한다.
 * 채워진 슬롯은 보존하고, 새 값이 있으면 우선한다. 배열은 합집합.
 * 원래 제품 질의(rawQuery)는 이전 것을 유지한다 — 멀티턴 되묻기에서 맥락 유실 방지.
 */
export function mergeIntent(prev: PurchaseIntent | undefined, next: PurchaseIntent): PurchaseIntent {
  if (!prev) return next;
  // 영속화된 옛 형태의 intent(새 배열 필드 부재)에도 안전하도록 방어적으로 처리
  const union = (a?: string[], b?: string[]) => Array.from(new Set([...(a ?? []), ...(b ?? [])]));
  const merged: PurchaseIntent = {
    rawQuery: prev.rawQuery || next.rawQuery,
    category: next.category ?? prev.category,
    useCase: next.useCase ?? prev.useCase,
    budgetKRW: mergeBudget(prev.budgetKRW, next.budgetKRW),
    mustHaves: union(prev.mustHaves, next.mustHaves),
    niceToHaves: union(prev.niceToHaves, next.niceToHaves),
    dealbreakers: union(prev.dealbreakers, next.dealbreakers),
    mustHavesConfirmed: prev.mustHavesConfirmed || next.mustHavesConfirmed,
    maxDeliveryDays: next.maxDeliveryDays ?? prev.maxDeliveryDays,
    extraCriteria: union(prev.extraCriteria, next.extraCriteria),
    priorityHints: union(prev.priorityHints, next.priorityHints),
    missingSlots: [],
  };
  merged.missingSlots = computeMissingSlots(merged);
  return merged;
}

/** 사용 가능한 예산 값(양수)인지 — '유효 예산' 정의의 단일 출처(자체감사 A2). */
function usableBudget(v: number | undefined): v is number {
  return typeof v === 'number' && v > 0;
}

function hasBudget(b: PurchaseIntent['budgetKRW']): boolean {
  return b != null && (usableBudget(b.min) || usableBudget(b.max));
}

/**
 * 예산 부분 갱신 병합: 새 발화가 한쪽(min 또는 max)만 줘도 기존 반대쪽 값을 보존한다.
 * (예: 1턴 "최소 5만" → 2턴 "최대 10만"이면 {min:50000,max:100000})
 * LLM이 0/음수로 오추출한 값은 기존 값을 덮어쓰지 않는다(자체감사 A2).
 */
function mergeBudget(
  prev: PurchaseIntent['budgetKRW'],
  next: PurchaseIntent['budgetKRW'],
): PurchaseIntent['budgetKRW'] {
  if (!hasBudget(next)) return prev;
  if (!hasBudget(prev)) return next;
  const merged: { min?: number; max?: number } = {
    min: usableBudget(next!.min) ? next!.min : prev!.min,
    max: usableBudget(next!.max) ? next!.max : prev!.max,
  };
  if (!usableBudget(merged.min)) delete merged.min;
  if (!usableBudget(merged.max)) delete merged.max;
  return merged;
}

const SLOT_QUESTIONS: Record<string, string> = {
  useCase: '어떤 용도로 쓰실 건가요? 사용 맥락을 알려주시면 더 잘 골라드려요.',
  budgetKRW: '예산은 어느 정도로 생각하세요?',
  mustHaves: '꼭 있어야 하는 조건이 있나요? (없으면 "없음")',
};

const SLOT_OPTIONS: Record<string, string[]> = {
  mustHaves: ['없음'],
};

export function nextQuestion(intent: PurchaseIntent): string | null {
  const slot = intent.missingSlots[0];
  if (!slot) return null;
  return SLOT_QUESTIONS[slot] ?? null;
}

/** 되묻기에 곁들일 클릭 옵션 (E1). 없으면 undefined */
export function nextQuestionOptions(intent: PurchaseIntent): string[] | undefined {
  const slot = intent.missingSlots[0];
  if (!slot) return undefined;
  return SLOT_OPTIONS[slot];
}
