import type { SearchHit } from './types';
import { withTimeout } from './timeout';
import { Semaphore } from '@/lib/llm/semaphore';

/**
 * firecrawl 검색/스크랩 래퍼 (공식 SDK @mendable/firecrawl-js 사용).
 * API 키가 없으면 검색은 빈 결과로 우아하게 degrade한다.
 * SDK native 타임아웃 + race 안전망 이중으로 무한 대기를 막는다.
 */

const SEARCH_TIMEOUT_MS = 15_000;
const SCRAPE_TIMEOUT_MS = 30_000;

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    price: { type: 'string' },
    shipping: { type: 'string' },
    seller: { type: 'string' },
    rating: { type: 'string' },
    reviewCount: { type: 'string' },
    images: { type: 'array', items: { type: 'string' } },
    specs: { type: 'object', additionalProperties: { type: 'string' } },
    ratingHistogram: { type: 'object', additionalProperties: { type: 'number' } },
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          rating: { type: 'number' },
          date: { type: 'string' },
          hasPhoto: { type: 'boolean' },
        },
      },
    },
    adLabel: { type: 'string' },
    deliveryDays: { type: 'string' }, // 배송 예상 소요일(숫자/문구)
    nutrition: { type: 'object', additionalProperties: { type: 'string' } }, // 식품 영양성분
    detailedSpecs: { type: 'object', additionalProperties: { type: 'string' } }, // 전자/기계 상세스펙
    material: { type: 'object', additionalProperties: { type: 'string' } }, // 의류 소재/혼용률
  },
} as const;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '알수없음';
  }
}

let cached: any;
async function client(): Promise<any | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  if (!cached) {
    const mod = await import('@mendable/firecrawl-js');
    const Firecrawl = mod.default;
    cached = new Firecrawl({ apiKey: key });
  }
  return cached;
}

export async function firecrawlSearch(
  queryStr: string,
  sites: string[],
  limit: number,
): Promise<SearchHit[]> {
  const fc = await client();
  if (!fc) return [];
  let res: any;
  try {
    // 사이트 제한은 쿼리 문자열 'site:' 대신 SDK 네이티브 옵션(includeDomains)으로 전달한다.
    // (SDK가 includeDomains를 무시할 수 있으나, 쿼리에는 site:를 넣지 않는다.)
    res = await withTimeout(
      fc.search(queryStr, { limit, timeout: SEARCH_TIMEOUT_MS, includeDomains: sites }),
      SEARCH_TIMEOUT_MS + 2000,
      'firecrawl search',
    );
  } catch (e) {
    console.error('[firecrawl] search 실패:', (e as Error).message);
    throw e;
  }
  const hits: Array<Record<string, any>> =
    res?.web ?? res?.data ?? res?.results ?? (Array.isArray(res) ? res : []);
  // 광고 판정은 SDK 검색결과에 없는 sponsored 필드 대신 스크랩의 adLabel로 일원화한다.
  // (isSponsored 필드는 타입 호환을 위해 남기되 검색 단계에서는 설정하지 않는다.)
  return hits
    .filter((d) => d?.url)
    .map((d, i) => ({
      url: d.url,
      title: d.title ?? d.description ?? '',
      marketplace: hostnameOf(d.url),
      searchRank: i,
    }));
}

const BASE_PROMPT =
  '이 상품 페이지에서 상품명/가격/배송비/판매자/평점/후기수/이미지/사양과, 상위 후기 본문(text)·작성일(date)·별점(rating)·사진여부(hasPhoto) 표본, 별점 분포(ratingHistogram), 광고/스폰서 표기(adLabel), 배송 예상 소요일(deliveryDays), 그리고 카테고리에 맞는 심층 정보(식품이면 영양성분 nutrition, 전자/기계면 상세스펙 detailedSpecs, 의류면 소재·혼용률 material)를 추출.';

// 스크랩 동시성 제한(레이트리밋 방지) + 짧은 TTL 캐시(턴/세션 간 중복 스크랩 방지)
const scrapeSemaphore = new Semaphore(Number(process.env.SHOPSCOUT_SCRAPE_CONCURRENCY ?? 4));
const scrapeCache = new Map<string, { at: number; data: Record<string, any> }>();
const SCRAPE_TTL_MS = 10 * 60 * 1000;

function buildScrapePrompt(hints?: string[]): string {
  if (!hints || hints.length === 0) return BASE_PROMPT;
  return `${BASE_PROMPT}\n특히 이 카테고리에서는 다음 항목을 반드시 찾아 추출하라: ${hints.join(', ')}.`;
}

async function scrapeOnce(fc: any, url: string, hints?: string[]): Promise<any> {
  return withTimeout(
    fc.scrape(url, {
      formats: [{ type: 'json', prompt: buildScrapePrompt(hints), schema: PRODUCT_SCHEMA }, 'markdown'],
      onlyMainContent: true,
      timeout: SCRAPE_TIMEOUT_MS,
    }),
    SCRAPE_TIMEOUT_MS + 2000,
    'firecrawl scrape',
  );
}

/**
 * 카테고리 hints를 반영해 상품 페이지를 스크랩한다.
 * - 동시성 제한 + TTL 캐시 + 1회 재시도
 * - json 추출이 비면 markdown에서 가격 등 최소 정보를 보강 파싱
 */
export async function firecrawlScrape(url: string, hints?: string[]): Promise<Record<string, any>> {
  const fc = await client();
  if (!fc) throw new Error('FIRECRAWL_API_KEY 없음');

  // hints가 다르면 추출 결과가 달라지므로 캐시 키에 hints를 포함한다.
  const hintKey = hints && hints.length > 0 ? `|${hints.slice().sort().join(',')}` : '';
  const cacheKey = url + hintKey;
  const cached = scrapeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SCRAPE_TTL_MS) return cached.data;

  const data = await scrapeSemaphore.run(async () => {
    let doc: any;
    try {
      doc = await scrapeOnce(fc, url, hints);
    } catch (e1) {
      // 1회 재시도(짧은 백오프)
      await new Promise((r) => setTimeout(r, 600));
      try {
        doc = await scrapeOnce(fc, url, hints);
      } catch (e2) {
        console.error('[firecrawl] scrape 실패(재시도 후):', (e2 as Error).message);
        throw e2;
      }
    }
    const json: Record<string, any> = doc?.json ?? doc?.data?.json ?? doc?.extract ?? {};
    const markdown: string | undefined = doc?.markdown ?? doc?.data?.markdown;
    // json에 가격이 없으면 markdown에서 보강. 단 첫 '…원'을 무조건 쓰면 배송비/정가/적립포인트를
    // 가격으로 오인하므로(bug7): (a) 비판매가 맥락 키워드 제외 + (b) 남은 후보 중 최빈값(상품가는 반복 노출) 선택.
    if (!json.price && markdown) {
      const best = pickPriceFromMarkdown(markdown);
      if (best) {
        json.price = best + '원';
        json.priceFallback = true; // 저신뢰 폴백 가격 표시
      }
    }
    return json;
  });

  // title도 price도 없으면 무효 스크랩으로 간주: throw 해서 호출부(gatherListings)가 건너뛰게 한다.
  // 무효/빈 결과는 캐시에 저장하지 않는다(나중에 정상 스크랩될 여지를 남김).
  if (!data.title && !data.price) {
    throw new Error('무효 스크랩(제목·가격 모두 없음)');
  }

  scrapeCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

/** 가격 '앞'에 오는 비판매가 키워드(예: "배송 3,000원", "적립 500원", "정가 89,000원") */
const NON_SALE_BEFORE = /(배송|적립|포인트|정가|쿠폰|카드|할인|마일리지|예치금|혜택|최대)/;
/** 가격 '바로 뒤'에 명사로 오는 비판매가(예: "3,000원 배송비"). 시작 앵커라 "빠른배송" 같은 오제외를 막는다. */
const NON_SALE_AFTER = /^\s*(배송비|배송료|배송|적립|포인트|마일리지|예치금|쿠폰)/;

/**
 * markdown에서 판매가 후보를 보수적으로 고른다(자체감사 A10).
 * - 가격 직전(12자)에 비판매가 키워드가 있으면 제외(배송/적립/정가 등 — "배송비 3,000원").
 * - 가격 바로 뒤가 배송비/적립 등 명사로 시작하면 제외("3,000원 배송비"). "빠른배송"처럼 명사 시작이
 *   아니면 제외하지 않는다.
 * - 남은 후보 중 '첫 등장(상품 상단의 판매가)'을 택한다(번들/옵션 반복값에 휘둘리지 않게 빈도는 쓰지 않음).
 */
export function pickPriceFromMarkdown(markdown: string): string | undefined {
  for (const m of markdown.matchAll(/([0-9][0-9,]{2,})\s*원/g)) {
    const idx = m.index ?? 0;
    const before = markdown.slice(Math.max(0, idx - 12), idx);
    const after = markdown.slice(idx + m[0].length, idx + m[0].length + 8);
    if (NON_SALE_BEFORE.test(before) || NON_SALE_AFTER.test(after)) continue;
    return m[1];
  }
  return undefined;
}

/** 테스트용 캐시 초기화 */
export function clearScrapeCache(): void {
  scrapeCache.clear();
}
