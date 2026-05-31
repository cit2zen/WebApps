import { describe, it, expect, beforeEach } from 'vitest';
import { prioritizeRubric, clearPriorityCache, hashIntent } from '@/lib/taxonomy/prioritize';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { emptyIntent } from '@/lib/types';
import type { ResolvedRubric } from '@/lib/taxonomy/types';

const rubric: ResolvedRubric = {
  nodeId: 'electronics_refrigerator',
  nodeName: '냉장고',
  criteria: [
    { key: 'capacity', label: '용량', check: 'c', dataNeeded: [], weight: 0.5, redFlags: [] },
    { key: 'energy', label: '에너지효율', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] },
    { key: 'noise', label: '소음', check: 'c', dataNeeded: [], weight: 0.2, redFlags: [] },
  ],
  scrapeHints: [],
  dynamic: false,
};

beforeEach(() => clearPriorityCache());

describe('prioritizeRubric', () => {
  it('목적에 따라 가중치를 재조정하고 합이 1에 가깝다', async () => {
    const intent = { ...emptyIntent('냉장고'), useCase: '1인가구 원룸' };
    const critKey = rubric.criteria.map((c) => c.key).sort().join(',');
    const llm = new MockLlmClient({
      [`prioritize:${rubric.nodeId}::${rubric.nodeName}::${critKey}::${hashIntent(intent)}`]: {
        weights: [
          { key: 'capacity', importance: 0.1 }, // 1인가구라 용량 덜 중요
          { key: 'energy', importance: 0.6 },
          { key: 'noise', importance: 0.6 },
        ],
        note: '1인가구라 에너지효율·소음을 우선했어요.',
      },
    });
    const r = await prioritizeRubric(llm, rubric, intent);
    expect(r.note).toMatch(/에너지|소음/);
    const energy = r.rubric.criteria.find((c) => c.key === 'energy')!;
    const capacity = r.rubric.criteria.find((c) => c.key === 'capacity')!;
    expect(energy.weight).toBeGreaterThan(capacity.weight); // 재조정 반영
    const sum = r.rubric.criteria.reduce((a, c) => a + c.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.05);
  });

  it('LLM 실패 시 원본 루브릭을 그대로 반환', async () => {
    const r = await prioritizeRubric(new MockLlmClient({}), rubric, emptyIntent('냉장고'));
    expect(r.rubric.criteria.find((c) => c.key === 'capacity')!.weight).toBe(0.5);
    expect(r.note).toBe('');
  });

  it('기준이 비면 원본 그대로', async () => {
    const empty = { ...rubric, criteria: [] };
    const r = await prioritizeRubric(new MockLlmClient({}), empty, emptyIntent('x'));
    expect(r.rubric.criteria).toEqual([]);
  });
});
