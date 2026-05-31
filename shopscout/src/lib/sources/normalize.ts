import type { Listing, ReviewSample } from '@/lib/types';

/** 한국어 가격 문자열("98,000원", "무료배송")을 숫자(원)로 변환 */
export function parseKRW(s: string | number | undefined | null): number {
  if (s == null) return 0;
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (/무료/.test(s)) return 0;
  const digits = s.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** 후기 수 파서: '1.2만'→12000, '3천'→3000, '1,234'→1234, '2k'→2000. 모호하면 undefined. */
export function parseReviewCount(s: string | number | undefined | null): number | undefined {
  if (s == null) return undefined;
  if (typeof s === 'number') return Number.isFinite(s) ? s : undefined;
  const m = s.trim().match(/([\d,.]+)\s*(만|천|k|m)?/i);
  if (!m) return undefined;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return undefined;
  const unit = (m[2] ?? '').toLowerCase();
  const mult =
    unit === '만' ? 10000 : unit === '천' ? 1000 : unit === 'k' ? 1000 : unit === 'm' ? 1000000 : 1;
  return Math.round(num * mult);
}

/**
 * "2일", "3-5일", "내일도착" 등에서 예상 소요일을 추출.
 * 무관한 숫자(예: '2024년 출시', '재고 30개', '3,000원 배송')를 소요일로 오인하지 않도록
 * '일' 단위가 붙은 숫자 또는 순수 숫자 필드만 인정한다(bug21).
 */
export function parseDeliveryDays(s: string | number | undefined | null): number | undefined {
  if (s == null) return undefined;
  if (typeof s === 'number') return Number.isFinite(s) ? s : undefined;
  const str = s.trim();
  // 필드 전체가 숫자(또는 'N일')뿐이면 그대로 소요일로 본다.
  const pure = str.match(/^(\d+)\s*일?$/);
  if (pure) return Number(pure[1]);
  // 'N일' 패턴(범위 '3-5일' 포함)의 최댓값(보수적). '일' 없는 숫자(연도·수량·가격)는 무시.
  const dayMatches = [...str.matchAll(/(\d+)\s*일/g)].map((m) => Number(m[1]));
  if (dayMatches.length) return Math.max(...dayMatches);
  if (/내일|익일|당일|오늘/.test(str)) return 1;
  return undefined;
}

/**
 * 평점 파서: '4.8점', '별점 4.8', '4,8'(콤마 소수), '4.8/5', '4.8 out of 5', '리뷰 1234개 평점 4.8',
 * '5점 만점에 4.5' 등에서 0~5 평점 추출. '첫 숫자'를 무조건 쓰면 후기수(1234)나 만점표기(5)를
 * 평점으로 오인하므로(자체감사 A9), (1) 평점 단서 우선 → (2) 0~5 범위 숫자 폴백 순으로 잡는다.
 */
export function parseRating(s: string | number | undefined | null): number | undefined {
  if (s == null || s === '') return undefined;
  if (typeof s === 'number') return Number.isFinite(s) ? Math.min(5, Math.max(0, s)) : undefined;
  const norm = s.replace(/,(?=[0-9])/g, '.'); // 콤마 소수(4,8)를 점으로
  const val = (m: RegExpMatchArray | null): number | undefined => {
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : undefined;
  };
  // 우선순위로 평점을 잡는다. 후기수(1234·>5)와 만점 분모(5점 만점, /5, out of 5)를 평점으로 오인 금지.
  // 1) 평점/별점/rating 접두 뒤의 값 — "별점 4.8", "리뷰 1234개 평점 4.8"
  let r = val(norm.match(/(?:평점|별점|rating)\s*[:\s]*([0-5](?:\.[0-9]+)?)/i));
  if (r !== undefined) return r;
  // 2) "만점(에) X" — 분모가 아니라 만점 뒤의 값이 실제 평점("5점 만점에 4.5" → 4.5)
  r = val(norm.match(/만점[에\s]*([0-5](?:\.[0-9]+)?)/));
  if (r !== undefined) return r;
  // 3) 값 뒤 점/★/별 — 단, "점 만점"(분모)은 제외
  r = val(norm.match(/([0-5](?:\.[0-9]+)?)\s*(?:점(?!\s*만점)|★|별)/));
  if (r !== undefined) return r;
  // 4) "X/5", "X out of 5"의 분자
  r = val(norm.match(/([0-5](?:\.[0-9]+)?)\s*(?:\/|out\s*of)\s*[0-9]/i));
  if (r !== undefined) return r;
  // 5) 폴백: 0~5 범위의 첫 독립 숫자(후기수 같은 큰 수 회피)
  return val(norm.match(/(?<![0-9.])([0-5](?:\.[0-9]+)?)(?![0-9])/));
}

function objOrUndef(v: unknown): Record<string, string> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : undefined;
}

function stableId(raw: any, source: 'kr' | 'global'): string {
  if (raw.url) return `${source}-${raw.url}`;
  const title = String(raw.title ?? '').slice(0, 40);
  return `${source}-${title}-${parseKRW(raw.price)}`;
}

function normalizeReviews(raw: any): ReviewSample[] | undefined {
  if (!Array.isArray(raw.reviews)) return undefined;
  return raw.reviews
    // text가 없어도 rating/date가 있으면 유효 표본(별점 분포)이므로 보존한다(bug31).
    .filter((r: any) => typeof r === 'string' || (r && (r.text || r.rating != null || r.date)))
    .map((r: any) =>
      typeof r === 'string'
        ? { text: r }
        : {
            text: String(r.text ?? ''),
            rating: parseRating(r.rating),
            date: r.date ? String(r.date) : undefined,
            hasPhoto: typeof r.hasPhoto === 'boolean' ? r.hasPhoto : undefined,
          },
    );
}

/** 원본 스크랩 객체를 정규화된 Listing으로 변환 */
export function normalizeListing(raw: any, source: 'kr' | 'global'): Listing {
  const rating = parseRating(raw.rating);
  return {
    id: stableId(raw, source),
    source,
    marketplace: raw.marketplace ?? '알수없음',
    url: raw.url ?? '',
    title: raw.title ?? '',
    priceKRW: parseKRW(raw.price),
    shippingKRW: parseKRW(raw.shipping),
    seller: raw.seller,
    rating,
    reviewCount: parseReviewCount(raw.reviewCount),
    images: Array.isArray(raw.images) ? raw.images : [],
    rawSpecs: raw.specs && typeof raw.specs === 'object' ? raw.specs : {},
    reviews: normalizeReviews(raw),
    ratingHistogram:
      raw.ratingHistogram && typeof raw.ratingHistogram === 'object' ? raw.ratingHistogram : undefined,
    searchRank: typeof raw.searchRank === 'number' ? raw.searchRank : undefined,
    isSponsored: typeof raw.isSponsored === 'boolean' ? raw.isSponsored : undefined,
    adLabel: raw.adLabel ? String(raw.adLabel) : undefined,
    deliveryDays: parseDeliveryDays(raw.deliveryDays),
    nutrition: objOrUndef(raw.nutrition),
    detailedSpecs: objOrUndef(raw.detailedSpecs),
    material: objOrUndef(raw.material),
    raw,
  };
}
