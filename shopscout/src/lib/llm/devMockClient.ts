import type { LlmClient, StructuredCall } from './client';

/**
 * 개발/E2E용 스크립트 목. 자격증명 없이 전체 플로우를 시연할 수 있도록
 * key 패턴에 따라 그럴듯한 구조화 응답을 생성한다(결정적).
 */
export class DevMockLlmClient implements LlmClient {
  async structured<T>(call: StructuredCall<T>): Promise<T> {
    if (call.key.startsWith('purpose:')) {
      // 발화에 "용도/예산/필수"가 없으면 일부러 부족 슬롯을 만들지 않고 채워서 추천까지 진행
      const max = /(\d+)\s*만원/.exec(call.prompt);
      return {
        category: '일반',
        useCase: call.prompt.includes('용') ? call.prompt : '일반 사용',
        budgetKRW: max ? { max: Number(max[1]) * 10000 } : { max: 100000 },
        mustHaves: call.prompt.includes('무선') ? ['무선'] : ['기본 품질'],
        niceToHaves: [],
        dealbreakers: [],
      } as T;
    }
    if (call.key.startsWith('eval:')) {
      // R8 병합 평가: 6요소를 한 번에 반환
      const seed = call.key.length % 5;
      const base = 70 + seed * 4;
      const std = (score: number) => ({ score, confidence: 0.85, flags: [], rationale: '개발용 목 평가' });
      const keys = [...call.system.matchAll(/key=(\S+)/g)].map((m) => m[1]);
      const hasCategory = /\[요소 f\]/.test(call.system);
      return {
        a: std(base),
        b: std(base),
        c: std(Math.max(40, base - 5)),
        d: std(base),
        e: { ...std(base), mustHaveMet: true },
        ...(hasCategory
          ? {
              f: {
                criterionScores: (keys.length ? keys : ['fit']).map((k) => ({
                  key: k,
                  score: 78,
                  confidence: 0.7,
                  dataInsufficient: false,
                  flags: [],
                })),
                rationale: '개발용 카테고리 평가',
              },
            }
          : {}),
      } as T;
    }
    if (call.key.startsWith('classify:')) {
      return { nodeId: 'general', itemName: call.prompt.slice(0, 30), confidence: 0.5 } as T;
    }
    if (call.key.startsWith('rubric:')) {
      return {
        criteria: [
          { key: 'fit', label: '목적적합', check: '목적에 맞나', dataNeeded: [], weight: 0.3, redFlags: [] },
        ],
      } as T;
    }
    if (call.key.startsWith('evalcat:')) {
      // 시스템 프롬프트의 'key=...' 목록을 읽어 기준별 점수를 만든다(개발용)
      const keys = [...call.system.matchAll(/key=(\S+)/g)].map((m) => m[1]);
      const criterionScores = (keys.length ? keys : ['general']).map((k) => ({
        key: k,
        score: 78,
        confidence: 0.7,
        dataInsufficient: false,
        flags: [],
      }));
      return { criterionScores, rationale: '개발용 카테고리 평가' } as T;
    }
    if (call.key.startsWith('prioritize:')) {
      return { weights: [{ key: 'fit', importance: 0.8 }], note: '목적에 맞춰 핵심 기준을 우선했어요(개발용).' } as T;
    }
    throw new Error(`DevMock 미지원 key: ${call.key}`);
  }

  async structuredWithImages<T>(call: StructuredCall<T>): Promise<T> {
    return this.structured(call);
  }
}
