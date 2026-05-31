import { describe, it, expect } from 'vitest';
import { normalizeListing, parseKRW, parseReviewCount, parseDeliveryDays } from '@/lib/sources/normalize';
import sample from './fixtures/coupang-sample.json';

describe('parseKRW', () => {
  it('한국어 가격/무료배송/숫자를 처리', () => {
    expect(parseKRW('98,000원')).toBe(98000);
    expect(parseKRW('무료배송')).toBe(0);
    expect(parseKRW(3000)).toBe(3000);
    expect(parseKRW(undefined)).toBe(0);
  });
});

describe('parseReviewCount', () => {
  it('한국형 축약 표기를 해석', () => {
    expect(parseReviewCount('1,234')).toBe(1234);
    expect(parseReviewCount('1.2만')).toBe(12000);
    expect(parseReviewCount('3천')).toBe(3000);
    expect(parseReviewCount('2k')).toBe(2000);
    expect(parseReviewCount(500)).toBe(500);
    expect(parseReviewCount(undefined)).toBeUndefined();
  });
});

describe('parseDeliveryDays', () => {
  it('일수·범위·당일을 처리', () => {
    expect(parseDeliveryDays('2일')).toBe(2);
    expect(parseDeliveryDays('3-5일')).toBe(5); // 범위는 최댓값
    expect(parseDeliveryDays('내일도착')).toBe(1);
    expect(parseDeliveryDays('당일~5일')).toBe(5); // 키워드+숫자 혼합 시 숫자 우선(보수적)
    expect(parseDeliveryDays(4)).toBe(4);
    expect(parseDeliveryDays(undefined)).toBeUndefined();
  });
});

describe('normalizeListing', () => {
  it('쿠팡 샘플을 정규화한다', () => {
    const l = normalizeListing(sample, 'kr');
    expect(l.priceKRW).toBe(98000);
    expect(l.shippingKRW).toBe(0);
    expect(l.reviewCount).toBe(1234);
    expect(l.rating).toBe(4.5);
    expect(l.source).toBe('kr');
    expect(l.rawSpecs).toEqual({ 축: '적축', 연결: '무선' });
  });
});
