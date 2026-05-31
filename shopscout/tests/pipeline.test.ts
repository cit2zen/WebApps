import { describe, it, expect, afterEach } from 'vitest';
import { runTurn } from '@/lib/orchestrator/orchestrator';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { setTaxonomyForTest } from '@/lib/taxonomy/loader';
import type { ProductSource } from '@/lib/sources/types';
import type { Listing } from '@/lib/types';
import type { Taxonomy } from '@/lib/taxonomy/types';

const TAX: Taxonomy = {
  version: 'test',
  nodes: [
    {
      id: 'health',
      name: '건강',
      parent: 'root',
      keywords: [],
      scrapeHints: ['성분'],
      criteria: [],
    },
    {
      id: 'health.supplement',
      name: '건강기능식품',
      parent: 'health',
      keywords: ['비타민'],
      scrapeHints: ['함량'],
      criteria: [{ key: 'dosage', label: '함량', check: '1일권장량 적합?', dataNeeded: ['함량'], weight: 0.5, redFlags: ['과다'] }],
    },
  ],
};

const src: ProductSource = {
  name: 'kr',
  async search() {
    return [{ url: 'u1', title: '비타민C', marketplace: '쿠팡' }];
  },
  async fetchListing(h): Promise<Listing> {
    return { id: 'kr-1', source: 'kr', marketplace: '쿠팡', url: h.url, title: '비타민C', priceKRW: 15000, images: [], rawSpecs: {}, rating: 4.5, reviewCount: 500, raw: {} };
  },
};

const std = { score: 80, confidence: 0.9, flags: [], rationale: 'r' };

afterEach(() => setTaxonomyForTest(null)); // 실제 taxonomy.json 복원

describe('runTurn 전체 파이프라인 (분류→루브릭→ⓕ→appliedCriteria)', () => {
  it('카테고리 분류·평가가 추천에 반영된다', async () => {
    setTaxonomyForTest(TAX);
    const llm = new MockLlmClient({
      'purpose:pipe': {
        category: '건강', useCase: '면역', budgetKRW: { max: 30000 }, mustHaves: [], mustHavesConfirmed: true,
        niceToHaves: [], dealbreakers: [], extraCriteria: [], priorityHints: [],
      },
      'classify:비타민C': { nodeId: 'health.supplement', itemName: '비타민C', confidence: 0.9 },
      'eval:kr-1': {
        a: std, b: std, c: std, d: std, e: { ...std, mustHaveMet: true },
        f: { criterionScores: [{ key: 'dosage', score: 85, confidence: 0.8, dataInsufficient: false, flags: [] }], rationale: 'r' },
      },
    });
    const res = await runTurn({ llm, sources: [src], turnKey: 'pipe', utterance: '비타민C' });
    expect(res.kind).toBe('recommendation');
    if (res.kind === 'recommendation') {
      const rec = res.recommendation;
      // ⓕ 카테고리 요소가 평가에 포함
      expect(rec.ranked[0].evaluation.factors.some((f) => f.code === 'f')).toBe(true);
      // 이번에 본 기준(루브릭 라벨)이 노출
      expect(rec.appliedCriteria).toContain('함량');
      expect(rec.degraded).toBeFalsy();
    }
  });
});
