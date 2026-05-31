import { describe, it, expect } from 'vitest';
import { deterministicDealbreakers, mustHaveLiteralStatus } from '@/lib/evaluation/specMatch';
import { evaluateListing } from '@/lib/evaluation/team';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { emptyIntent, type Listing } from '@/lib/types';

function L(over: Partial<Listing> = {}): Listing {
  return {
    id: 'kr-1',
    source: 'kr',
    marketplace: '쿠팡',
    url: 'u',
    title: '무선 기계식 키보드 적축',
    priceKRW: 30000,
    images: ['i'],
    rawSpecs: { 축: '적축', 연결: '무선' },
    raw: {},
    ...over,
  };
}

describe('specMatch', () => {
  it('dealbreaker 리터럴이 제목/사양에 있으면 탐지', () => {
    const intent = { ...emptyIntent('키보드'), dealbreakers: ['리퍼', '청축'] };
    const hit = deterministicDealbreakers(L({ title: '키보드 리퍼 상품' }), intent);
    expect(hit).toContain('리퍼');
    expect(hit).not.toContain('청축'); // 적축이므로 청축 없음
  });

  it('mustHave 리터럴 충족/미충족을 분리(공백·기호 무시)', () => {
    const intent = { ...emptyIntent('키보드'), mustHaves: ['무 선', '저소음'] };
    const s = mustHaveLiteralStatus(L(), intent);
    expect(s.met).toContain('무 선'); // 정규화 후 '무선' 매칭
    expect(s.unmet).toContain('저소음');
  });

  it('단어 경계를 넘는 우연한 매칭은 오탐으로 보지 않는다', () => {
    // title='무선 기계식 키보드 적축'. 옛 구현은 공백을 모두 제거해
    // '식키'(기계식+키보드 경계)나 '드적'(키보드+적축 경계)이 거짓 매칭됐다.
    const intent = { ...emptyIntent('키보드'), dealbreakers: ['식키', '드적', '축무'] };
    const hit = deterministicDealbreakers(L(), intent);
    expect(hit).toHaveLength(0);
  });

  it('term의 공백/기호는 무시하되 hay의 단어 경계는 보존한다', () => {
    const intent = { ...emptyIntent('키보드'), mustHaves: ['무-선', '기계식'] };
    const s = mustHaveLiteralStatus(L(), intent);
    expect(s.met).toContain('무-선'); // '무-선' → 정규화 '무선' → hay 토큰 '무선'과 경계 일치
    expect(s.met).toContain('기계식'); // 토큰 그대로 일치
  });
});

function evalResp() {
  const f = { score: 85, confidence: 0.9, flags: [], rationale: 'r' };
  return { 'eval:kr-1': { a: f, b: f, c: f, d: f, e: f } };
}

describe('evaluateListing + 결정적 배제조건 게이트', () => {
  it('LLM이 통과시켜도 결정적 dealbreaker 위반이면 탈락', async () => {
    const intent = { ...emptyIntent('키보드'), dealbreakers: ['리퍼'] };
    const llm = new MockLlmClient(evalResp());
    const ev = await evaluateListing(llm, L({ title: '키보드 리퍼' }), intent);
    expect(ev.passesTrustThreshold).toBe(false);
    expect(ev.factors.find((f) => f.code === 'e')?.flags.some((x) => x.includes('금지조건'))).toBe(true);
  });

  it('배제조건 없으면 정상 통과', async () => {
    const intent = { ...emptyIntent('키보드'), dealbreakers: ['리퍼'] };
    const llm = new MockLlmClient(evalResp());
    const ev = await evaluateListing(llm, L({ title: '키보드 정품' }), intent);
    expect(ev.passesTrustThreshold).toBe(true);
  });
});
