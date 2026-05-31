import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchHit } from '@/lib/sources/types';

// firecrawl/exa 검색기를 목으로 대체해 병합·dedup·searchRank 재부여를 검증한다.
const firecrawlSearch = vi.fn<(q: string, sites: string[], limit: number) => Promise<SearchHit[]>>();
const exaSearch = vi.fn<(q: string, sites: string[], limit: number) => Promise<SearchHit[]>>();

vi.mock('@/lib/sources/firecrawl', () => ({
  firecrawlSearch: (...a: any[]) => (firecrawlSearch as any)(...a),
  // fetchListing 경로는 이 테스트에서 쓰지 않지만 import 해소를 위해 stub.
  firecrawlScrape: vi.fn(),
}));
vi.mock('@/lib/sources/exa', () => ({
  exaSearch: (...a: any[]) => (exaSearch as any)(...a),
}));

import { makeFirecrawlSource } from '@/lib/sources/firecrawlSource';
import { emptyIntent } from '@/lib/types';

describe('makeFirecrawlSource.search 병합/순위', () => {
  beforeEach(() => {
    firecrawlSearch.mockReset();
    exaSearch.mockReset();
  });

  it('병합·dedup 후 searchRank를 최종 인덱스로 재부여한다(충돌 제거)', async () => {
    // firecrawl과 exa 모두 자체 searchRank 0,1 을 매겨 충돌을 유발한다.
    firecrawlSearch.mockResolvedValue([
      { url: 'https://a.com/p/1', title: 'a1', marketplace: 'a.com', searchRank: 0 },
      { url: 'https://a.com/p/2', title: 'a2', marketplace: 'a.com', searchRank: 1 },
    ]);
    exaSearch.mockResolvedValue([
      { url: 'https://b.com/p/9', title: 'b9', marketplace: 'b.com', searchRank: 0 },
      { url: 'https://b.com/p/8', title: 'b8', marketplace: 'b.com', searchRank: 1 },
    ]);

    const src = makeFirecrawlSource('kr', ['a.com', 'b.com']);
    const hits = await src.search(emptyIntent('x'), 10);

    expect(hits.map((h) => h.searchRank)).toEqual([0, 1, 2, 3]);
    // firecrawl 결과가 앞(순위 신뢰), exa가 뒤.
    expect(hits.map((h) => h.url)).toEqual([
      'https://a.com/p/1',
      'https://a.com/p/2',
      'https://b.com/p/9',
      'https://b.com/p/8',
    ]);
  });

  it('firecrawl·exa가 같은 매물을 반환하면 dedup 후 단일 순위 유지', async () => {
    // www·트레일링 슬래시만 다른 동일 매물(dedupHits 키 기준 동일)
    firecrawlSearch.mockResolvedValue([
      { url: 'https://shop.com/p/1', title: 'fc', marketplace: 'shop.com', searchRank: 0 },
    ]);
    exaSearch.mockResolvedValue([
      { url: 'https://www.shop.com/p/1/', title: 'exa', marketplace: 'shop.com', searchRank: 0 },
      { url: 'https://shop.com/p/2', title: 'exa2', marketplace: 'shop.com', searchRank: 1 },
    ]);

    const src = makeFirecrawlSource('global', ['shop.com']);
    const hits = await src.search(emptyIntent('x'), 10);

    // 중복 1건 제거되어 2건, firecrawl 우선(같은 매물은 firecrawl 것 유지)
    expect(hits).toHaveLength(2);
    expect(hits[0].title).toBe('fc');
    expect(hits[1].url).toBe('https://shop.com/p/2');
    expect(hits.map((h) => h.searchRank)).toEqual([0, 1]);
  });

  it('limit 적용 후에도 searchRank가 0..n-1로 연속', async () => {
    firecrawlSearch.mockResolvedValue([
      { url: 'https://a.com/1', title: '', marketplace: 'a.com', searchRank: 0 },
      { url: 'https://a.com/2', title: '', marketplace: 'a.com', searchRank: 1 },
      { url: 'https://a.com/3', title: '', marketplace: 'a.com', searchRank: 2 },
    ]);
    exaSearch.mockResolvedValue([]);

    const src = makeFirecrawlSource('kr', ['a.com']);
    const hits = await src.search(emptyIntent('x'), 2);

    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.searchRank)).toEqual([0, 1]);
  });

  it('한쪽 검색이 실패해도 다른 쪽 결과로 순위를 재부여', async () => {
    firecrawlSearch.mockRejectedValue(new Error('boom'));
    exaSearch.mockResolvedValue([
      { url: 'https://b.com/1', title: '', marketplace: 'b.com', searchRank: 5 },
      { url: 'https://b.com/2', title: '', marketplace: 'b.com', searchRank: 7 },
    ]);

    const src = makeFirecrawlSource('global', ['b.com']);
    const hits = await src.search(emptyIntent('x'), 10);

    expect(hits.map((h) => h.searchRank)).toEqual([0, 1]);
  });
});
