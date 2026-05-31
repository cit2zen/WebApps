import { describe, it, expect } from 'vitest';
import { groupSameProduct, jaccard, titleTokens } from '@/lib/recommender/group';
import type { Evaluation, Listing, RankedItem } from '@/lib/types';

function item(id: string, title: string, price: number): RankedItem {
  const listing = {
    id,
    source: 'kr',
    marketplace: '쿠팡',
    url: id,
    title,
    priceKRW: price,
    images: [],
    rawSpecs: {},
    raw: {},
  } as Listing;
  const evaluation = {
    listingId: id,
    factors: [],
    trustScore: 80,
    passesTrustThreshold: true,
  } as Evaluation;
  return { listing, evaluation, reason: '' };
}

describe('titleTokens / jaccard', () => {
  it('동일 제목은 Jaccard 1', () => {
    expect(jaccard(titleTokens('무선 기계식 키보드'), titleTokens('무선 기계식 키보드'))).toBe(1);
  });
  it('전혀 다른 제목은 0', () => {
    expect(jaccard(titleTokens('무선 키보드'), titleTokens('블루투스 마우스'))).toBe(0);
  });
});

describe('groupSameProduct', () => {
  it('동일 상품(고유사도)을 묶고 첫(최저가) 항목을 대표로', () => {
    const out = groupSameProduct([
      item('a', '로지텍 MX 무선 기계식 키보드 적축', 30000),
      item('b', '로지텍 MX 무선 기계식 키보드 적축', 45000),
    ]);
    expect(out[0].duplicateOf).toBeUndefined(); // 대표
    expect(out[0].cheaperThanGroupCount).toBe(1);
    expect(out[1].duplicateOf).toBe('a'); // 중복
  });

  it('다른 상품은 별개 그룹으로 보존', () => {
    const out = groupSameProduct([
      item('a', '무선 기계식 키보드 적축', 30000),
      item('b', '게이밍 마우스 RGB 16000DPI', 25000),
    ]);
    expect(out.every((r) => r.duplicateOf === undefined)).toBe(true);
  });

  it('통과 매물 대표가 탈락 매물을 그룹에 포함하지 않는다(분류가 다르면 별개)', () => {
    // 동일상품이지만 분류가 다름: passing(통과)과 rest(탈락)를 각각 따로 그룹핑해야 한다.
    const passing = [item('p', '로지텍 MX 무선 기계식 키보드 적축', 45000)];
    const rest = [item('r', '로지텍 MX 무선 기계식 키보드 적축', 30000)]; // 더 싸지만 탈락 분류

    // 호출부(synthesize)와 동일하게 분류별로 따로 적용 후 연결
    const ranked = [...groupSameProduct(passing), ...groupSameProduct(rest)];

    const rep = ranked.find((r) => r.listing.id === 'p')!;
    const failed = ranked.find((r) => r.listing.id === 'r')!;

    // 통과 대표는 탈락 매물을 그룹에 흡수하지 않음
    expect(rep.duplicateOf).toBeUndefined();
    expect(rep.cheaperThanGroupCount ?? 0).toBe(0);
    // 탈락 매물은 통과 대표 아래로 접히지 않고 자기 분류의 별개 대표로 남음
    expect(failed.duplicateOf).toBeUndefined();
    expect(failed.group).toBe('r');
  });
});
