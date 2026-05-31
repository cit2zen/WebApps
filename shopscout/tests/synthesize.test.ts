import { describe, it, expect } from 'vitest';
import { synthesize, buildProsCons } from '@/lib/recommender/synthesize';
import { emptyIntent, type Evaluation, type FactorResult, type Listing, type PurchaseIntent } from '@/lib/types';

function L(id: string, price: number, shipping = 0): Listing {
  return {
    id,
    source: 'kr',
    marketplace: '쿠팡',
    url: id,
    title: id,
    priceKRW: price,
    shippingKRW: shipping,
    images: [],
    rawSpecs: {},
    raw: {},
  };
}

function E(id: string, trust: number, pass: boolean, flags: string[] = []): Evaluation {
  const factor: FactorResult = { code: 'e', score: 50, confidence: 1, flags, rationale: '' };
  return { listingId: id, factors: [factor], trustScore: trust, passesTrustThreshold: pass };
}

describe('synthesize', () => {
  it('신뢰 통과 매물 중 최저가를 1순위로', () => {
    const rec = synthesize([L('a', 50000), L('b', 30000)], [E('a', 80, true), E('b', 80, true)]);
    expect(rec.ranked[0].listing.id).toBe('b');
  });

  it('통과 매물을 미통과 매물보다 앞에 둔다', () => {
    const rec = synthesize(
      [L('a', 10000), L('b', 30000)],
      [E('a', 20, false, ['미끼가의심']), E('b', 80, true)],
    );
    expect(rec.ranked[0].listing.id).toBe('b');
  });

  it('최저가가 임계 미달이면 확인 질의를 만든다', () => {
    const rec = synthesize(
      [L('a', 50000), L('b', 30000)],
      [E('a', 80, true), E('b', 20, false, ['미끼가의심'])],
    );
    expect(rec.askUser?.reason).toBe('cheapest-failed');
  });

  it('"대안있음" 플래그가 있으면 대안 질의', () => {
    const rec = synthesize([L('a', 50000)], [E('a', 80, true, ['대안있음'])]);
    expect(rec.askUser?.reason).toBe('alternative');
  });

  it('summary: 1순위 매물과 가격·신뢰 근거를 담는다', () => {
    const rec = synthesize([L('a', 50000), L('b', 30000)], [E('a', 80, true), E('b', 82, true)]);
    expect(rec.summary).toBeTruthy();
    expect(rec.summary).toContain('b'); // 최저가 통과 매물 = b
    expect(rec.summary).toMatch(/30,000원|신뢰/);
  });

  it('summary: 통과 매물이 없으면 그 사실을 알린다', () => {
    const rec = synthesize([L('a', 50000)], [E('a', 20, false, ['미끼가의심'])]);
    expect(rec.summary).toMatch(/신뢰|찾지|없/);
  });

  it('상위 두 후보가 근소하면 질의', () => {
    const rec = synthesize(
      [L('a', 30000), L('b', 31000)],
      [E('a', 80, true), E('b', 78, true)],
    );
    expect(rec.askUser?.reason).toBe('close-top');
  });

  it('예산(max) 초과 매물은 통과 티어에서 제외하고 더 비싸도 예산 내 매물을 1순위로', () => {
    const intent: PurchaseIntent = { ...emptyIntent('x'), budgetKRW: { max: 40000 } };
    const rec = synthesize(
      [L('cheap', 30000), L('over', 100000)],
      [E('cheap', 80, true), E('over', 95, true)],
      intent,
    );
    expect(rec.ranked[0].listing.id).toBe('cheap');
    const over = rec.ranked.find((r) => r.listing.id === 'over');
    expect(over?.reason).toMatch(/예산/);
  });

  it('예산 정보가 없으면 기존대로 동작', () => {
    const rec = synthesize([L('a', 100000)], [E('a', 80, true)]);
    expect(rec.ranked[0].listing.id).toBe('a');
  });

  it('가격이 근소하면 신뢰 높은 매물을 1순위로(tie-break)', () => {
    // 가격차 2천원(5% 이내) → 신뢰 높은 b가 1순위
    const rec = synthesize([L('a', 50000), L('b', 51000)], [E('a', 60, true), E('b', 90, true)]);
    expect(rec.ranked[0].listing.id).toBe('b');
  });

  it('가격차가 크면 최저가 우선(tie-break 미적용)', () => {
    const rec = synthesize([L('a', 30000), L('b', 90000)], [E('a', 60, true), E('b', 95, true)]);
    expect(rec.ranked[0].listing.id).toBe('a');
  });

  it('배송기한 초과 매물은 통과 티어에서 제외', () => {
    const intent: PurchaseIntent = { ...emptyIntent('x'), maxDeliveryDays: 3 };
    const fast = { ...L('fast', 50000), deliveryDays: 2 };
    const slow = { ...L('slow', 30000), deliveryDays: 10 };
    const rec = synthesize([fast, slow], [E('fast', 80, true), E('slow', 80, true)], intent);
    expect(rec.ranked[0].listing.id).toBe('fast'); // 더 비싸도 기한 내가 1순위
    const slowItem = rec.ranked.find((r) => r.listing.id === 'slow');
    expect(slowItem?.reason).toMatch(/배송기한/);
  });
});

describe('buildProsCons', () => {
  function ev(factors: FactorResult[]): Evaluation {
    return { listingId: 'x', factors, trustScore: 70, passesTrustThreshold: true };
  }
  it('고득점은 장점, 플래그/저점은 단점', () => {
    const { pros, cons } = buildProsCons(
      ev([
        { code: 'a', score: 90, confidence: 0.9, flags: [], rationale: '' },
        { code: 'c', score: 20, confidence: 0.9, flags: ['미끼가의심'], rationale: '' },
      ]),
      false,
      false,
    );
    expect(pros.some((p) => p.includes('후기'))).toBe(true);
    expect(cons.some((c) => c.includes('가격'))).toBe(true);
  });
  it("'대안있음' 정보성 플래그만 있으면 cons에 넣지 않는다", () => {
    const { cons } = buildProsCons(
      ev([{ code: 'e', score: 80, confidence: 0.9, flags: ['대안있음'], rationale: '' }]),
      false,
      false,
    );
    expect(cons.some((c) => c.includes('우려'))).toBe(false);
  });
  it("'대안있음'과 함께 다른 우려 플래그가 있으면 cons에 넣되 '대안있음'은 제외", () => {
    const { cons } = buildProsCons(
      ev([{ code: 'c', score: 20, confidence: 0.9, flags: ['대안있음', '미끼가의심'], rationale: '' }]),
      false,
      false,
    );
    const concern = cons.find((c) => c.includes('우려'));
    expect(concern).toBeTruthy();
    expect(concern).toContain('미끼가의심');
    expect(concern).not.toContain('대안있음');
  });
  it('빠른 배송은 장점, 예산초과는 단점', () => {
    const { pros, cons } = buildProsCons(ev([]), true, false, 1);
    expect(pros.some((p) => p.includes('빠른 배송'))).toBe(true);
    expect(cons).toContain('예산 초과');
  });
});
