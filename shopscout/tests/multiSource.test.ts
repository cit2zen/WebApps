import { describe, it, expect } from 'vitest';
import { gatherListings, canonicalUrl } from '@/lib/sources/index';
import type { ProductSource } from '@/lib/sources/types';
import { emptyIntent, type Listing } from '@/lib/types';

const ok: ProductSource = {
  name: 'ok',
  async search() {
    return [{ url: 'u1', title: 't', marketplace: 'm' }];
  },
  async fetchListing(h): Promise<Listing> {
    return {
      id: h.url,
      source: 'kr',
      marketplace: 'm',
      url: h.url,
      title: 't',
      priceKRW: 100,
      images: [],
      rawSpecs: {},
      raw: {},
    };
  },
};

const broken: ProductSource = {
  name: 'broken',
  async search() {
    throw new Error('blocked');
  },
  async fetchListing() {
    throw new Error('blocked');
  },
};

const partialFetch: ProductSource = {
  name: 'partial',
  async search() {
    return [
      { url: 'good', title: 't', marketplace: 'm' },
      { url: 'bad', title: 't', marketplace: 'm' },
    ];
  },
  async fetchListing(h): Promise<Listing> {
    if (h.url === 'bad') throw new Error('scrape blocked');
    return {
      id: h.url,
      source: 'kr',
      marketplace: 'm',
      url: h.url,
      title: 't',
      priceKRW: 200,
      images: [],
      rawSpecs: {},
      raw: {},
    };
  },
};

describe('gatherListings', () => {
  it('일부 소스 실패해도 정상 결과를 반환하고 실패를 보고', async () => {
    const res = await gatherListings([ok, broken], emptyIntent('x'), 5);
    expect(res.listings.length).toBe(1);
    expect(res.failedSources).toContain('broken');
  });

  it('소스 내 일부 스크랩 실패는 건너뛴다', async () => {
    const res = await gatherListings([partialFetch], emptyIntent('x'), 5);
    expect(res.listings.length).toBe(1);
    expect(res.listings[0].id).toBe('good');
    expect(res.failedSources).toEqual([]);
  });

  it('스크랩 전에 maxListings 상한을 적용한다 (불필요한 스크랩 차단)', async () => {
    let fetchCount = 0;
    const src: ProductSource = {
      name: 'cap',
      async search() {
        return Array.from({ length: 6 }).map((_, i) => ({ url: `https://s.com/p/${i}`, title: 't', marketplace: 'm' }));
      },
      async fetchListing(h): Promise<Listing> {
        fetchCount++;
        return { id: h.url, source: 'kr', marketplace: 'm', url: h.url, title: 't', priceKRW: 1, images: [], rawSpecs: {}, raw: {} };
      },
    };
    const res = await gatherListings([src], emptyIntent('x'), 6, undefined, 2);
    expect(fetchCount).toBe(2); // 6개 검색됐지만 2개만 스크랩
    expect(res.listings.length).toBe(2);
  });

  it('상한이 첫 소스를 독식하지 않게 소스를 인터리브한다 (해외 소스 굶김 방지)', async () => {
    const mkSource = (name: string, n: number): ProductSource => ({
      name,
      async search() {
        return Array.from({ length: n }).map((_, i) => ({ url: `https://${name}.com/p/${i}`, title: 't', marketplace: name }));
      },
      async fetchListing(h): Promise<Listing> {
        return { id: h.url, source: name === 'kr' ? 'kr' : 'global', marketplace: name, url: h.url, title: 't', priceKRW: 1, images: [], rawSpecs: {}, raw: {} };
      },
    });
    // kr·global 각 6개 검색, 상한 4 → 단순 소스순이면 global 0건. 라운드로빈이면 2:2.
    const res = await gatherListings([mkSource('kr', 6), mkSource('global', 6)], emptyIntent('x'), 6, undefined, 4);
    expect(res.listings.length).toBe(4);
    expect(res.attempted).toBe(4);
    expect(res.listings.some((l) => l.marketplace === 'global')).toBe(true);
    expect(res.listings.filter((l) => l.marketplace === 'kr').length).toBe(2);
  });

  it('검색은 됐으나 스크랩이 전부 실패하면 attempted>0·listings=0 (장애 식별 가능)', async () => {
    const allScrapeFail: ProductSource = {
      name: 'kr',
      async search() {
        return [{ url: 'https://s.com/1', title: 't', marketplace: 'm' }, { url: 'https://s.com/2', title: 't', marketplace: 'm' }];
      },
      async fetchListing(): Promise<Listing> {
        throw new Error('scrape blocked');
      },
    };
    const res = await gatherListings([allScrapeFail], emptyIntent('x'), 5);
    expect(res.listings.length).toBe(0);
    expect(res.failedSources).toEqual([]); // 검색은 성공 → failedSources 비어 있음
    expect(res.attempted).toBe(2); // 스크랩을 2개 시도했음(전량 실패)
  });

  it('scrapeHints를 fetchListing까지 전달한다 (카테고리별 스크랩)', async () => {
    let received: string[] | undefined;
    const src: ProductSource = {
      name: 'h',
      async search() {
        return [{ url: 'u', title: 't', marketplace: 'm' }];
      },
      async fetchListing(h, hints): Promise<Listing> {
        received = hints;
        return {
          id: h.url, source: 'kr', marketplace: 'm', url: h.url, title: 't',
          priceKRW: 1, images: [], rawSpecs: {}, raw: {},
        };
      },
    };
    await gatherListings([src], emptyIntent('x'), 5, ['영양성분표', '유통기한']);
    expect(received).toEqual(['영양성분표', '유통기한']);
  });

  function urlSource(urls: string[]): ProductSource {
    return {
      name: 'u',
      async search() {
        return urls.map((url) => ({ url, title: 't', marketplace: 'm' }));
      },
      async fetchListing(h): Promise<Listing> {
        return {
          id: h.url,
          source: 'kr',
          marketplace: 'm',
          url: h.url,
          title: 't',
          priceKRW: 100,
          images: [],
          rawSpecs: {},
          raw: {},
        };
      },
    };
  }

  it('추적 파라미터·www·슬래시만 다른 매물은 중복 제거한다', async () => {
    const res = await gatherListings(
      [urlSource(['https://shop.com/p/1?ref=a', 'https://www.shop.com/p/1/?utm_source=x'])],
      emptyIntent('x'),
      5,
    );
    expect(res.listings.length).toBe(1);
  });

  it('상품 식별 파라미터(itemId)가 다르면 별개 매물로 보존한다', async () => {
    const res = await gatherListings(
      [urlSource(['https://11st.co.kr/item?itemId=123', 'https://11st.co.kr/item?itemId=456'])],
      emptyIntent('x'),
      5,
    );
    expect(res.listings.length).toBe(2);
  });
});

describe('canonicalUrl', () => {
  it('추적 파라미터 제거 + 키 정렬 + 인코딩으로 동일 상품을 같은 키로', () => {
    const a = canonicalUrl('https://www.shop.com/p?b=2&a=1&utm_source=x');
    const b = canonicalUrl('https://shop.com/p/?a=1&b=2');
    expect(a).toBe(b);
  });
  it('값에 특수문자(&,=)가 있어도 키가 오염되지 않는다', () => {
    const a = canonicalUrl('https://shop.com/p?q=a%26b');
    const b = canonicalUrl('https://shop.com/p?q=a&b=');
    expect(a).not.toBe(b); // q=a&b (인코딩) vs q=a + b= 는 서로 다른 매물
  });
});
