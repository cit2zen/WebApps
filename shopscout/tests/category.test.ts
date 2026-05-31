import { describe, it, expect } from 'vitest';
import { evaluateCategory } from '@/lib/evaluation/category';
import { evaluateListing } from '@/lib/evaluation/team';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { emptyIntent, type Listing } from '@/lib/types';
import type { ResolvedRubric } from '@/lib/taxonomy/types';

const listing: Listing = {
  id: 'kr-1',
  source: 'kr',
  marketplace: '쿠팡',
  url: 'u',
  title: '비타민C 1000mg',
  priceKRW: 15000,
  images: [],
  rawSpecs: {},
  nutrition: { 비타민C: '1000mg' },
  raw: {},
};

const rubric: ResolvedRubric = {
  nodeId: 'health.vitamin',
  nodeName: '비타민',
  criteria: [
    { key: 'dosage', label: '함량', check: '1일권장량 적합?', dataNeeded: ['함량'], weight: 0.5, redFlags: ['과다'] },
  ],
  scrapeHints: ['성분함량'],
  dynamic: false,
};

describe('evaluateCategory (ⓕ)', () => {
  it('기준별 점수를 weight 가중합으로 종합한다', async () => {
    const llm = new MockLlmClient({
      'evalcat:kr-1:health.vitamin': {
        criterionScores: [{ key: 'dosage', score: 88, confidence: 0.8, dataInsufficient: false, flags: [] }],
        rationale: '함량 적정',
      },
    });
    const f = await evaluateCategory(llm, listing, emptyIntent('비타민C'), rubric);
    expect(f.code).toBe('f');
    expect(f.score).toBe(88); // 단일 기준이므로 그 점수
    expect(f.criterionScores?.[0].key).toBe('dosage');
  });

  it('가중치가 종합 점수를 결정한다(가중 평균)', async () => {
    const two: ResolvedRubric = {
      ...rubric,
      criteria: [
        { key: 'a', label: 'A', check: 'c', dataNeeded: [], weight: 0.8, redFlags: [] },
        { key: 'b', label: 'B', check: 'c', dataNeeded: [], weight: 0.2, redFlags: [] },
      ],
    };
    const llm = new MockLlmClient({
      'evalcat:kr-1:health.vitamin': {
        criterionScores: [
          { key: 'a', score: 100, confidence: 1, dataInsufficient: false, flags: [] },
          { key: 'b', score: 0, confidence: 1, dataInsufficient: false, flags: [] },
        ],
        rationale: '',
      },
    });
    const f = await evaluateCategory(llm, listing, emptyIntent('x'), two);
    expect(f.score).toBe(80); // 0.8*100 + 0.2*0
  });

  it('플래그+저점 기준이 있으면 카테고리위험 플래그', async () => {
    const llm = new MockLlmClient({
      'evalcat:kr-1:health.vitamin': {
        criterionScores: [{ key: 'dosage', score: 20, confidence: 0.9, dataInsufficient: false, flags: ['과다'] }],
        rationale: '',
      },
    });
    const f = await evaluateCategory(llm, listing, emptyIntent('x'), rubric);
    expect(f.flags).toContain('카테고리위험');
  });

  it('호출 실패는 infraFailure', async () => {
    const f = await evaluateCategory(new MockLlmClient({}), listing, emptyIntent('x'), rubric);
    expect(f.infraFailure).toBe(true);
  });

  it('기준이 없으면 dataInsufficient', async () => {
    const empty: ResolvedRubric = { ...rubric, criteria: [] };
    const f = await evaluateCategory(new MockLlmClient({}), listing, emptyIntent('x'), empty);
    expect(f.dataInsufficient).toBe(true);
  });
});

function mergedWith(f?: any) {
  const std = { score: 85, confidence: 0.9, flags: [], rationale: 'r' };
  return { 'eval:kr-1': { a: std, b: std, c: std, d: std, e: std, ...(f ? { f } : {}) } };
}

describe('evaluateListing + ⓕ (병합)', () => {
  it('rubric을 주면 6번째 요소(ⓕ)가 추가된다', async () => {
    const resp = mergedWith({
      criterionScores: [{ key: 'dosage', score: 80, confidence: 0.8, dataInsufficient: false, flags: [] }],
      rationale: 'r',
    });
    const ev = await evaluateListing(new MockLlmClient(resp), listing, emptyIntent('비타민C'), [listing], rubric);
    expect(ev.factors.length).toBe(6);
    expect(ev.factors.some((f) => f.code === 'f')).toBe(true);
  });

  it('ⓕ 카테고리위험이면 임계 통과 실패(하드 게이트)', async () => {
    const resp = mergedWith({
      criterionScores: [{ key: 'dosage', score: 20, confidence: 0.9, dataInsufficient: false, flags: ['과다'] }],
      rationale: 'r',
    });
    const ev = await evaluateListing(new MockLlmClient(resp), listing, emptyIntent('비타민C'), [listing], rubric);
    expect(ev.passesTrustThreshold).toBe(false);
  });

  it('rubric이 없으면 기존 5요소만', async () => {
    const ev = await evaluateListing(new MockLlmClient(mergedWith()), listing, emptyIntent('비타민C'));
    expect(ev.factors.length).toBe(5);
  });
});
