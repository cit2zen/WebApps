import { describe, it, expect } from 'vitest';
import { emptyIntent, totalPrice } from '@/lib/types';

describe('types', () => {
  it('emptyIntent는 빈 슬롯 배열을 가진다', () => {
    const i = emptyIntent('무선 키보드');
    expect(i.rawQuery).toBe('무선 키보드');
    expect(i.mustHaves).toEqual([]);
    expect(i.missingSlots).toEqual([]);
  });
  it('totalPrice는 배송비를 더한다', () => {
    expect(totalPrice({ priceKRW: 10000, shippingKRW: 3000 })).toBe(13000);
    expect(totalPrice({ priceKRW: 10000 })).toBe(10000);
  });
});
