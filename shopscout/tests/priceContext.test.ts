import { describe, it, expect } from 'vitest';
import { computePriceContext } from '@/lib/evaluation/team';
import type { Listing } from '@/lib/types';

function L(price: number): Listing {
  return {
    id: String(price),
    source: 'kr',
    marketplace: 'm',
    url: String(price),
    title: 't',
    priceKRW: price,
    images: [],
    rawSpecs: {},
    raw: {},
  };
}

describe('computePriceContext', () => {
  it('표본 1개면 undefined', () => {
    expect(computePriceContext([L(100)])).toBeUndefined();
  });

  it('짝수 표본에서 median은 중앙 두 값의 평균', () => {
    const ctx = computePriceContext([L(10), L(20), L(30), L(40)]);
    expect(ctx?.median).toBe(25); // (20+30)/2
    expect(ctx?.min).toBe(10);
  });

  it('두 표본에서 median이 max에 고정되지 않는다', () => {
    const ctx = computePriceContext([L(10), L(30)]);
    expect(ctx?.median).toBe(20); // 보간: (10+30)/2, 과거 버그는 30 반환
  });
});
