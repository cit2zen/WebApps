import { describe, it, expect } from 'vitest';
import { evaluateListing } from '@/lib/evaluation/team';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { emptyIntent, type Listing } from '@/lib/types';
import type { ResolvedRubric } from '@/lib/taxonomy/types';

const listing: Listing = {
  id: 'kr-1',
  source: 'kr',
  marketplace: '쿠팡',
  url: 'u',
  title: '무선 키보드',
  priceKRW: 30000,
  images: ['i'],
  rawSpecs: {},
  reviewCount: 1000,
  rating: 4.5,
  raw: {},
};

const intent = { ...emptyIntent('무선 키보드'), useCase: '코딩', mustHaves: ['무선'] };

const std = (over: Record<string, any> = {}) => ({ score: 80, confidence: 0.9, flags: [], rationale: 'r', ...over });

/** 병합 평가(R8) 목 응답: key 'eval:kr-1' 하나에 6요소 */
function merged(over: Record<string, Record<string, any>> = {}) {
  return {
    'eval:kr-1': {
      a: std(over.a),
      b: std(over.b),
      c: std(over.c),
      d: std(over.d),
      e: std(over.e),
    },
  };
}

describe('evaluateListing (병합 평가)', () => {
  it('5요소를 평가하고 도메인가중 종합점수를 만든다', async () => {
    const ev = await evaluateListing(new MockLlmClient(merged()), listing, intent);
    expect(ev.factors.length).toBe(5);
    expect(ev.trustScore).toBe(80);
    expect(ev.passesTrustThreshold).toBe(true);
  });

  it('가격 요소에 미끼가 플래그가 있으면 임계 통과 실패', async () => {
    const ev = await evaluateListing(
      new MockLlmClient(merged({ c: { score: 10, flags: ['미끼가의심'] } })),
      listing,
      intent,
    );
    expect(ev.passesTrustThreshold).toBe(false);
  });

  it('병합 호출 실패 시 전 요소 infraFailure로 degrade하고 탈락', async () => {
    // eval:kr-1 미등록 → structured throw → 전체 infra 실패
    const ev = await evaluateListing(new MockLlmClient({}), listing, intent);
    expect(ev.factors.length).toBe(5);
    expect(ev.factors.every((f) => f.infraFailure === true)).toBe(true);
    expect(ev.passesTrustThreshold).toBe(false);
  });

  it('일부 요소 dataInsufficient는 하드 탈락이 아니라 coverage 감점', async () => {
    const ev = await evaluateListing(
      new MockLlmClient(merged({ a: { confidence: 0.3, dataInsufficient: true, flags: ['정보부족'] } })),
      listing,
      intent,
    );
    // 단일 요소 정보부족은 red flag가 아니며 통과 (가격 등 정상)
    expect(ev.passesTrustThreshold).toBe(true);
  });

  it('dataInsufficient 요소가 많으면 커버리지 패널티로 신뢰가 감점된다', async () => {
    const evFull = await evaluateListing(new MockLlmClient(merged()), listing, intent);
    const evSparse = await evaluateListing(
      new MockLlmClient(
        merged({
          a: { confidence: 0.3, dataInsufficient: true },
          b: { confidence: 0.3, dataInsufficient: true },
          d: { confidence: 0.3, dataInsufficient: true },
        }),
      ),
      listing,
      intent,
    );
    expect(evSparse.trustScore).toBeLessThan(evFull.trustScore);
  });

  it('ⓔ dealbreakerHit이면 임계 통과 실패', async () => {
    const ev = await evaluateListing(
      new MockLlmClient(merged({ e: { dealbreakerHit: true } })),
      listing,
      intent,
    );
    expect(ev.passesTrustThreshold).toBe(false);
  });

  it('ⓔ mustHaveMet=false면 임계 통과 실패', async () => {
    const ev = await evaluateListing(
      new MockLlmClient(merged({ e: { mustHaveMet: false } })),
      listing,
      intent,
    );
    expect(ev.passesTrustThreshold).toBe(false);
  });

  it('rubric이 있는데 모델이 f 블록을 누락하면 ⓕ를 infraFailure로 처리(0점 데이터부족이 아님)', async () => {
    const rubric: ResolvedRubric = {
      nodeId: 'kbd', nodeName: '키보드',
      criteria: [{ key: 'switch', label: '스위치', check: '타건감 적합?', dataNeeded: ['스위치'], weight: 1, redFlags: [] }],
      scrapeHints: [], dynamic: false,
    };
    // merged()는 f 키를 넣지 않는다 → rubric 있어도 모델이 f를 빠뜨린 상황 재현
    const ev = await evaluateListing(new MockLlmClient(merged()), listing, intent, [listing], rubric);
    const f = ev.factors.find((x) => x.code === 'f');
    expect(f).toBeDefined();
    expect(f!.infraFailure).toBe(true);
    // a~e는 정상 80점이므로, f가 coverage 분모에서 빠져 신뢰점수는 a~e 기준으로 유지된다(=80)
    expect(ev.trustScore).toBe(80);
  });
});
