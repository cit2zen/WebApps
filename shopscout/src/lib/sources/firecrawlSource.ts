import type { ProductSource, SearchHit } from './types';
import type { PurchaseIntent } from '@/lib/types';
import { firecrawlSearch, firecrawlScrape } from './firecrawl';
import { exaSearch } from './exa';
import { normalizeListing } from './normalize';
import { dedupKey } from './index';

/** 정규 URL 기준 검색 결과 dedup (firecrawl+exa 병합용) — gatherListings와 동일 규칙(dedupKey) 공유 */
function dedupHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const key = dedupKey(h.url, h.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/**
 * firecrawl 기반 ProductSource 팩토리. kr/global은 사이트 목록만 다르게 공유한다(DRY).
 * 검색은 firecrawl + exa를 병합(union)해 커버리지를 높이고 dedup한다.
 * 스크랩은 카테고리 hints를 반영한다.
 */
export function makeFirecrawlSource(name: 'kr' | 'global', sites: string[]): ProductSource {
  return {
    name,
    async search(intent: PurchaseIntent, limit: number): Promise<SearchHit[]> {
      // firecrawl과 exa를 병렬로 돌려 병합(한쪽 실패해도 다른 쪽 결과 사용).
      // 단, '키 없음' degrade는 [] 로 resolve되고, 실제 장애만 reject된다.
      // 두 제공자가 모두 reject면(전량 장애) throw해 gatherListings가 failedSources로 집계 → degraded 표면화(bug19).
      const [fcR, exaR] = await Promise.allSettled([
        firecrawlSearch(intent.rawQuery, sites, limit),
        exaSearch(intent.rawQuery, sites, limit),
      ]);
      if (fcR.status === 'rejected') {
        console.error(`[source:${name}] firecrawl 검색 실패:`, (fcR.reason as Error)?.message);
      }
      if (exaR.status === 'rejected') {
        console.error(`[source:${name}] exa 검색 실패:`, (exaR.reason as Error)?.message);
      }
      if (fcR.status === 'rejected' && exaR.status === 'rejected') {
        throw new Error(`[source:${name}] 모든 검색 제공자 실패`);
      }
      const fc = fcR.status === 'fulfilled' ? fcR.value : [];
      const exa = exaR.status === 'fulfilled' ? exaR.value : [];
      // firecrawl 결과를 앞에 두고(순위 신뢰), exa로 보강 후 dedup, limit 적용.
      // 병합·dedup 후 최종 배열 인덱스로 searchRank를 재부여해 단일 순위 체계를 보장한다.
      return dedupHits([...fc, ...exa])
        .slice(0, limit)
        .map((h, i) => ({ ...h, searchRank: i }));
    },
    async fetchListing(hit, hints) {
      const json = await firecrawlScrape(hit.url, hints);
      return normalizeListing(
        {
          ...json,
          url: hit.url,
          marketplace: hit.marketplace,
          title: json.title ?? hit.title,
          searchRank: hit.searchRank,
          isSponsored: hit.isSponsored,
        },
        name,
      );
    },
  };
}
