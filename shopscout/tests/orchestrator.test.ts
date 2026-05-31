import { describe, it, expect } from 'vitest';
import { runTurn } from '@/lib/orchestrator/orchestrator';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { MemoryStore } from '@/lib/store/sqliteStore';
import type { ProductSource } from '@/lib/sources/types';
import type { Listing } from '@/lib/types';

const src: ProductSource = {
  name: 'kr',
  async search() {
    return [{ url: 'u1', title: '무선 키보드', marketplace: '쿠팡' }];
  },
  async fetchListing(h): Promise<Listing> {
    return {
      id: 'kr-1',
      source: 'kr',
      marketplace: '쿠팡',
      url: h.url,
      title: h.title,
      priceKRW: 30000,
      images: ['i'],
      rawSpecs: {},
      rating: 4.5,
      reviewCount: 1000,
      raw: {},
    };
  },
};

function evalResponses() {
  const f = { score: 80, confidence: 0.9, flags: [], rationale: 'r' };
  return { 'eval:kr-1': { a: f, b: f, c: f, d: f, e: f } };
}

describe('runTurn', () => {
  it('슬롯 충분하면 추천까지 진행', async () => {
    const llm = new MockLlmClient({
      'purpose:t1': {
        category: '키보드',
        useCase: '코딩',
        budgetKRW: { max: 100000 },
        mustHaves: ['무선'],
        niceToHaves: [],
        dealbreakers: [],
      },
      ...evalResponses(),
    });
    const res = await runTurn({ llm, sources: [src], turnKey: 't1', utterance: '무선 키보드 코딩용 10만원' });
    expect(res.kind).toBe('recommendation');
    if (res.kind === 'recommendation') {
      expect(res.recommendation.ranked[0].listing.id).toBe('kr-1');
      expect(res.failedSources).toEqual([]);
    }
  });

  it('모든 소스 실패 시 degraded 플래그(진짜 0건과 구분)', async () => {
    const broken: ProductSource = {
      name: 'broken',
      async search() {
        throw new Error('blocked');
      },
      async fetchListing(h): Promise<Listing> {
        return { id: h.url, source: 'kr', marketplace: 'm', url: h.url, title: 't', priceKRW: 1, images: [], rawSpecs: {}, raw: {} };
      },
    };
    const llm = new MockLlmClient({
      'purpose:tdeg': {
        useCase: '코딩', budgetKRW: { max: 100000 }, mustHaves: ['무선'], mustHavesConfirmed: true,
        niceToHaves: [], dealbreakers: [],
      },
    });
    const res = await runTurn({ llm, sources: [broken], turnKey: 'tdeg', utterance: '무선 키보드 코딩 10만원' });
    expect(res.kind).toBe('recommendation');
    if (res.kind === 'recommendation') {
      expect(res.recommendation.degraded).toBe(true);
      expect(res.failedSources).toContain('broken');
    }
  });

  it('검색은 됐으나 스크랩 전량 실패도 degraded(진짜 0건 아님)', async () => {
    const scrapeFail: ProductSource = {
      name: 'kr',
      async search() {
        return [{ url: 'https://s.com/1', title: 't', marketplace: 'm' }];
      },
      async fetchListing(): Promise<Listing> {
        throw new Error('blocked');
      },
    };
    const llm = new MockLlmClient({
      'purpose:tsf': {
        useCase: '코딩', budgetKRW: { max: 100000 }, mustHaves: [], mustHavesConfirmed: true,
        niceToHaves: [], dealbreakers: [],
      },
    });
    const res = await runTurn({ llm, sources: [scrapeFail], turnKey: 'tsf', utterance: '무선 키보드 10만원' });
    expect(res.kind).toBe('recommendation');
    if (res.kind === 'recommendation') {
      expect(res.recommendation.degraded).toBe(true);
      expect(res.failedSources).toEqual([]); // 검색은 성공
    }
  });

  it('슬롯 부족하면 되묻기', async () => {
    const llm = new MockLlmClient({
      'purpose:t2': { category: '키보드', mustHaves: [], niceToHaves: [], dealbreakers: [] },
    });
    const res = await runTurn({ llm, sources: [src], turnKey: 't2', utterance: '키보드' });
    expect(res.kind).toBe('question');
  });

  it('필수조건 "없음" 확인 시(빈 mustHaves) 무한루프 없이 추천까지 도달', async () => {
    const llm = new MockLlmClient({
      'purpose:t3': {
        useCase: '코딩',
        budgetKRW: { max: 100000 },
        mustHaves: [],
        mustHavesConfirmed: true,
        niceToHaves: [],
        dealbreakers: [],
      },
      ...evalResponses(),
    });
    const res = await runTurn({ llm, sources: [src], turnKey: 't3', utterance: '키보드, 필수조건 없음' });
    expect(res.kind).toBe('recommendation');
  });

  it('signal이 이미 aborted면 runTurn이 AbortError로 조기 종료한다', async () => {
    const llm = new MockLlmClient({
      'purpose:tAbort': {
        category: '키보드',
        useCase: '코딩',
        budgetKRW: { max: 100000 },
        mustHaves: ['무선'],
        niceToHaves: [],
        dealbreakers: [],
      },
      ...evalResponses(),
    });
    // 이미 중단된 신호: understanding 이후 searching 직전 경계에서 조기 종료해야 한다.
    const signal = AbortSignal.abort();
    await expect(
      runTurn({ llm, sources: [src], turnKey: 'tAbort', utterance: '무선 키보드 코딩용 10만원', signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('멀티턴: 되묻기 후 후속 발화가 이전 intent와 병합되어 추천까지 도달', async () => {
    const store = new MemoryStore();
    // 1턴: 제품만 → 예산/용도 부족으로 되묻기
    const llm1 = new MockLlmClient({
      'purpose:conv1': { category: '키보드', mustHaves: ['무선'], niceToHaves: [], dealbreakers: [] },
    });
    const r1 = await runTurn({ llm: llm1, sources: [src], store, turnKey: 'conv1', utterance: '무선 키보드' });
    expect(r1.kind).toBe('question');

    // 2턴: 사용자가 '코딩용 10만원'만 답함 → 이전(키보드/무선)과 병합되어 슬롯 충족
    const llm2 = new MockLlmClient({
      'purpose:conv1': { useCase: '코딩', budgetKRW: { max: 100000 }, mustHaves: [], niceToHaves: [], dealbreakers: [] },
      ...evalResponses(),
    });
    const r2 = await runTurn({ llm: llm2, sources: [src], store, turnKey: 'conv1', utterance: '코딩용 10만원' });
    expect(r2.kind).toBe('recommendation');
    const saved = await store.getConversation('conv1');
    expect(saved?.intent?.mustHaves).toContain('무선'); // 1턴 슬롯 보존
    expect(saved?.intent?.budgetKRW?.max).toBe(100000); // 2턴 값 병합
  });
});
