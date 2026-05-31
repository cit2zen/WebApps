import type { SearchHit } from './types';
import { withTimeout } from './timeout';

/**
 * exa 폴백 검색기. firecrawl 검색이 0건/실패일 때 대체 검색 경로로 사용.
 * EXA_API_KEY 없으면 빈 결과로 우아하게 degrade.
 */

const TIMEOUT_MS = 15_000;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '알수없음';
  }
}

let cached: any;
async function client(): Promise<any | null> {
  const key = process.env.EXA_API_KEY;
  if (!key) return null;
  if (!cached) {
    const mod = await import('exa-js');
    const Exa = mod.default;
    cached = new Exa(key);
  }
  return cached;
}

export async function exaSearch(
  queryStr: string,
  sites: string[],
  limit: number,
): Promise<SearchHit[]> {
  const exa = await client();
  if (!exa) return [];
  // url/title만 필요하므로 contents:false로 본문 크롤링 비용을 끈다
  const res: any = await withTimeout(
    exa.search(queryStr, { numResults: limit, includeDomains: sites, contents: false }),
    TIMEOUT_MS,
    'exa search',
  );
  const hits: Array<Record<string, any>> = res?.results ?? [];
  return hits
    .filter((d) => d?.url)
    .map((d, i) => ({
      url: d.url,
      title: d.title ?? '',
      marketplace: hostnameOf(d.url),
      searchRank: i,
    }));
}
