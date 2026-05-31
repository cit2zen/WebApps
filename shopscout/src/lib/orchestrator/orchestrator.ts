import type { LlmClient } from '@/lib/llm/client';
import type { ProductSource } from '@/lib/sources/types';
import type { Store } from '@/lib/store/types';
import { gatherListings } from '@/lib/sources/index';
import { discoverIntent, mergeIntent, nextQuestion, nextQuestionOptions } from '@/lib/purpose/discovery';
import { evaluateListing } from '@/lib/evaluation/team';
import { synthesize } from '@/lib/recommender/synthesize';
import { loadTaxonomy } from '@/lib/taxonomy/loader';
import { resolveRubricForIntent } from '@/lib/taxonomy/rubric';
import { prioritizeRubric } from '@/lib/taxonomy/prioritize';
import { config } from '@/lib/config';
import { emptyIntent, type PurchaseIntent, type Recommendation } from '@/lib/types';

/** 한 요청에서 평가하는 매물 전역 상한 (config로 이전) */
export const MAX_LISTINGS = config.maxListings;

export type ProgressStage = 'understanding' | 'searching' | 'evaluating' | 'ranking';
export interface ProgressEvent {
  stage: ProgressStage;
  detail?: { count?: number };
}

export interface TurnInput {
  llm: LlmClient;
  sources: ProductSource[];
  turnKey: string;
  utterance: string;
  perSource?: number;
  /** 멀티턴 상태 저장소(없으면 단일 턴으로 동작) */
  store?: Store;
  /** 진행 단계 콜백(E7 스트리밍용) */
  onProgress?: (e: ProgressEvent) => void;
  /** 클라이언트 연결 종료 시 추가 작업을 중단하기 위한 신호 */
  signal?: AbortSignal;
}

export type TurnResult =
  | { kind: 'question'; question: string; options?: string[] }
  | { kind: 'recommendation'; recommendation: Recommendation; failedSources: string[] };

/**
 * 한 대화 턴을 처리한다:
 * (이전 intent 로드·병합) → 목적 파악 → 슬롯 부족 시 되묻기 → 수집 → 평가 팀 → 종합 추천 → 저장.
 */
export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const progress = input.onProgress ?? (() => {});
  // 단계 경계에서 연결 종료(abort)를 감지해 추가 작업/LLM 호출을 막는다.
  const throwIfAborted = () => {
    if (input.signal?.aborted) throw new DOMException('aborted', 'AbortError');
  };

  progress({ stage: 'understanding' });

  const prev = input.store ? await input.store.getConversation(input.turnKey) : null;
  // 멀티턴 되묻기: 직전에 물은 슬롯을 discovery에 전달해 짧은 답변을 그 슬롯으로 해석시킨다(useCase 무한루프 방지).
  const askedSlot = prev?.intent?.missingSlots?.[0];
  // 첫(필수) LLM 호출 — 실패해도 턴 전체를 거부하지 않는다(bug26).
  let discovered: PurchaseIntent;
  try {
    discovered = await discoverIntent(input.llm, input.turnKey, input.utterance, {
      askedSlot,
      prev: prev?.intent,
    });
  } catch (err) {
    console.warn(`[turn] key=${input.turnKey} discoverIntent 실패, degrade:`, (err as Error)?.message ?? err);
    // 누적된 직전 슬롯이 있으면 그걸 보존하며 진행(다음 부족 슬롯 되묻기). 첫 턴(누적 없음)에 실패하면
    // emptyIntent로 degrade해봐야 사용자 발화의 모든 정보가 소실돼 useCase부터 전면 되묻기가 되므로,
    // 발화를 버리지 말고 일시 오류로 재입력을 유도한다(자체감사 A8).
    const hasPrior =
      !!prev?.intent &&
      (!!prev.intent.useCase ||
        prev.intent.budgetKRW?.min != null ||
        prev.intent.budgetKRW?.max != null ||
        (prev.intent.mustHaves?.length ?? 0) > 0);
    if (!hasPrior) {
      return { kind: 'question', question: '일시적인 오류가 발생했어요. 방금 입력을 한 번만 다시 보내주시겠어요?' };
    }
    discovered = emptyIntent(input.utterance); // prev가 있으면 mergeIntent가 기존 슬롯을 보존
  }
  const intent = mergeIntent(prev?.intent, discovered);

  const q = nextQuestion(intent);
  if (q) {
    await input.store?.saveConversation({ id: input.turnKey, intent });
    return { kind: 'question', question: q, options: nextQuestionOptions(intent) };
  }

  // 카테고리 분류 → 전용 루브릭 해결(턴당 1회). 수집 전에 해결해 scrapeHints를 스크랩에 주입한다.
  const tax = await loadTaxonomy();
  // rubric 해결/우선순위 실패를 조용히 삼키지 않고 관측한다(bug8): 시스템적 LLM 실패가
  // 평범한 범용 추천으로 위장하는 것을 막기 위해 로그를 남기고 degraded 신호로 표면화한다.
  let rubricFailed = false;
  const resolved = await resolveRubricForIntent(input.llm, tax, intent).catch((err) => {
    rubricFailed = true;
    console.warn(`[turn] key=${input.turnKey} rubric 해결 실패, 범용으로 폴백:`, (err as Error)?.message ?? err);
    return undefined;
  });
  // 목적 기반 우선순위: 사용자 목적에 따라 기준 가중치를 재조정(실패 시 원본 유지)
  let rubric = resolved;
  let priorityNote = '';
  if (resolved) {
    const prioritized = await prioritizeRubric(input.llm, resolved, intent).catch((err) => {
      rubricFailed = true;
      console.warn(`[turn] key=${input.turnKey} rubric 우선순위 실패, 원본 유지:`, (err as Error)?.message ?? err);
      return { rubric: resolved, note: '' };
    });
    rubric = prioritized.rubric;
    priorityNote = prioritized.note;
  }

  throwIfAborted();
  progress({ stage: 'searching' });
  // 스크랩 전 상한(config.maxListings)을 gatherListings에 넘겨 불필요한 스크랩 비용 차단
  const { listings, failedSources, attempted } = await gatherListings(
    input.sources,
    intent,
    input.perSource ?? config.perSource,
    rubric?.scrapeHints,
    config.maxListings,
    input.signal,
  );

  throwIfAborted();
  progress({ stage: 'evaluating', detail: { count: listings.length } });
  const evals = await Promise.all(
    listings.map((l) => evaluateListing(input.llm, l, intent, listings, rubric)),
  );

  throwIfAborted();
  progress({ stage: 'ranking' });
  const recommendation = synthesize(listings, evals, intent);
  if (priorityNote) recommendation.priorityNote = priorityNote;
  if (rubric && rubric.criteria.length > 0) {
    recommendation.appliedCriteria = rubric.criteria.map((c) => c.label);
  }
  // 장애로 결과가 빈 경우 — 진짜 '0건'과 구분(#13). 검색 전량 실패뿐 아니라
  // '검색은 됐으나 스크랩이 전부 실패(attempted>0, listings=0)'한 경우도 degraded로 본다.
  if (
    listings.length === 0 &&
    input.sources.length > 0 &&
    (failedSources.length >= input.sources.length || attempted > 0)
  ) {
    recommendation.degraded = true;
  }

  await input.store?.saveConversation({
    id: input.turnKey,
    intent,
    lastRecommendation: recommendation,
  });

  // 관측성(R12): 턴 메트릭 로깅 (실패율·매물 수·예상 LLM 호출 수·rubric 실패 여부)
  console.info(
    `[turn] key=${input.turnKey} listings=${listings.length} failedSources=${failedSources.join(',') || '-'} ` +
      `degraded=${recommendation.degraded ? 1 : 0} rubricFailed=${rubricFailed ? 1 : 0} llmCalls≈${listings.length + 3}`,
  );

  return { kind: 'recommendation', recommendation, failedSources };
}
