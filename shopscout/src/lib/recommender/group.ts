import type { RankedItem } from '@/lib/types';

/** 제목을 토큰 집합으로 (길이 2+ 의미 토큰) */
export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[\s\-_/().,~!?]+/g, ' ')
      .split(' ')
      .filter((t) => t.length >= 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const SAME_PRODUCT_THRESHOLD = 0.8;

/**
 * 동일 상품(제목 토큰 Jaccard ≥ 0.8)을 묶어, 입력 순서상 먼저 오는(=더 싼) 항목을 대표로,
 * 나머지는 duplicateOf로 표시한다. 보수적 임계로 서로 다른 상품의 오병합을 줄인다.
 * 입력은 '동일 분류(통과/탈락 등) 내에서 가격순으로 정렬'되어 있다고 가정한다.
 * 분류가 다른 항목을 섞어 넣으면 안 된다 — 호출부에서 분류별로 따로 적용할 것.
 */
export function groupSameProduct(items: RankedItem[]): RankedItem[] {
  const reps: { rep: RankedItem; tokens: Set<string> }[] = [];
  const out: RankedItem[] = [];
  for (const item of items) {
    const tk = titleTokens(item.listing.title);
    const match = reps.find((r) => jaccard(r.tokens, tk) >= SAME_PRODUCT_THRESHOLD);
    if (match) {
      match.rep.cheaperThanGroupCount = (match.rep.cheaperThanGroupCount ?? 0) + 1;
      out.push({ ...item, group: match.rep.listing.id, duplicateOf: match.rep.listing.id });
    } else {
      const rep: RankedItem = { ...item, group: item.listing.id };
      reps.push({ rep, tokens: tk });
      out.push(rep);
    }
  }
  return out;
}
