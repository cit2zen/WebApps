import { describe, it, expect } from 'vitest';
import { computeMissingSlots, discoverIntent, mergeIntent, nextQuestion } from '@/lib/purpose/discovery';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { emptyIntent, type PurchaseIntent } from '@/lib/types';

describe('discoverIntent', () => {
  it('LLM 추출 결과로 PurchaseIntent를 만들고 부족 슬롯을 채운다', async () => {
    const llm = new MockLlmClient({
      'purpose:k1': {
        category: '키보드',
        budgetKRW: { max: 100000 },
        mustHaves: ['무선'],
        niceToHaves: [],
        dealbreakers: [],
      },
    });
    const intent = await discoverIntent(llm, 'k1', '무선 키보드 10만원');
    expect(intent.category).toBe('키보드');
    expect(intent.missingSlots).toContain('useCase'); // 용도 누락
    expect(intent.missingSlots).not.toContain('budgetKRW');
  });

  it('모든 핵심 슬롯이 채워지면 missingSlots는 비어 있다', async () => {
    const llm = new MockLlmClient({
      'purpose:k2': {
        category: '키보드',
        useCase: '코딩',
        budgetKRW: { max: 100000 },
        mustHaves: ['무선'],
        niceToHaves: [],
        dealbreakers: [],
      },
    });
    const intent = await discoverIntent(llm, 'k2', '코딩용 무선 키보드 10만원');
    expect(intent.missingSlots).toEqual([]);
  });
});

describe('computeMissingSlots', () => {
  it('budgetKRW가 빈 객체 {}면 미충족으로 본다', () => {
    const intent: PurchaseIntent = {
      ...emptyIntent('x'),
      useCase: '코딩',
      mustHaves: ['무선'],
      budgetKRW: {},
    };
    expect(computeMissingSlots(intent)).toContain('budgetKRW');
  });
  it('budgetKRW.max가 숫자면 충족', () => {
    const intent: PurchaseIntent = {
      ...emptyIntent('x'),
      useCase: '코딩',
      mustHaves: ['무선'],
      budgetKRW: { max: 100000 },
    };
    expect(computeMissingSlots(intent)).not.toContain('budgetKRW');
  });

  it('mustHaves가 비었어도 "없음" 확인 시 미충족이 아니다 (무한루프 방지)', () => {
    const base: PurchaseIntent = {
      ...emptyIntent('x'),
      useCase: '코딩',
      budgetKRW: { max: 100000 },
      mustHaves: [],
    };
    expect(computeMissingSlots(base)).toContain('mustHaves');
    expect(computeMissingSlots({ ...base, mustHavesConfirmed: true })).not.toContain('mustHaves');
  });
});

describe('mergeIntent', () => {
  it('이전 제품 질의와 슬롯을 보존하며 새 발화의 값을 병합한다', () => {
    const prev: PurchaseIntent = {
      ...emptyIntent('무선 기계식 키보드'),
      category: '키보드',
      mustHaves: ['무선'],
    };
    const next: PurchaseIntent = { ...emptyIntent('10만원'), budgetKRW: { max: 100000 } };
    const merged = mergeIntent(prev, next);
    expect(merged.rawQuery).toBe('무선 기계식 키보드'); // 원래 질의 유지
    expect(merged.budgetKRW?.max).toBe(100000); // 새 값 반영
    expect(merged.mustHaves).toContain('무선'); // 이전 슬롯 보존
  });
  it('prev가 없으면 next를 그대로 반환', () => {
    const next: PurchaseIntent = { ...emptyIntent('x'), useCase: '코딩' };
    expect(mergeIntent(undefined, next)).toBe(next);
  });
});

describe('nextQuestion', () => {
  it('첫 부족 슬롯에 대한 질문을 반환', () => {
    expect(nextQuestion({ missingSlots: ['useCase'] } as any)).toMatch(/용도/);
  });
  it('부족 슬롯 없으면 null', () => {
    expect(nextQuestion({ missingSlots: [] } as any)).toBeNull();
  });
});
