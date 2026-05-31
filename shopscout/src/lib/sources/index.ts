import type { Listing, PurchaseIntent } from '@/lib/types';
import type { ProductSource } from './types';

export interface GatherResult {
  listings: Listing[];
  failedSources: string[];
  /** 스크랩을 시도한 후보 수 — 검색은 됐으나 스크랩이 전부 실패한 경우(전량 장애) 판별용 */
  attempted: number;
}

/** 추적 파라미터만 제거하고 상품 식별 파라미터(itemId 등)는 보존하는 정규 URL (dedup용).
 * 일부 쇼핑몰은 같은 path에서 쿼리 파라미터로 상품을 구분하므로 쿼리를 통째로 버리면 안 된다. */
const TRACKING_PARAM = /^(utm_|spm|ref|src|from|fbclid|gclid|_trk)/i;
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '');
    const sp = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!TRACKING_PARAM.test(k)) sp.append(k, v);
    }
    sp.sort();
    const qs = sp.toString(); // 자동 인코딩 — 값의 &/= 로 인한 키 오염 방지
    return `${host}${path}${qs ? `?${qs}` : ''}`;
  } catch {
    return url;
  }
}

/** dedup 키 — url이 있으면 정규 URL, 없으면 정규화된 제목(소스명 비포함).
 * 세 단계(검색/스크랩/소스 내부)가 동일 규칙을 공유해 url 누락 시 동작이 갈리지 않게 한다. */
export function dedupKey(url?: string, title?: string): string {
  if (url) return canonicalUrl(url);
  return (title ?? '').trim().toLowerCase();
}

/**
 * 여러 소스를 병렬로 검색·스크랩한다.
 * 한 소스가 실패해도 나머지 결과를 반환하고 실패 소스를 보고한다(부분 결과 허용).
 */
export async function gatherListings(
  sources: ProductSource[],
  intent: PurchaseIntent,
  perSource: number,
  scrapeHints?: string[],
  maxListings?: number,
  /** 클라이언트 연결 종료 시 진행 중 스크랩 배치를 더 시작하지 않기 위한 신호(비용 누수 방지, bug36) */
  signal?: AbortSignal,
): Promise<GatherResult> {
  const failedSources: string[] = [];

  // 1단계: 검색(가벼움)만 먼저 — 소스별 hit 수집
  const searchResults = await Promise.all(
    sources.map(async (src) => {
      try {
        const hits = await src.search(intent, perSource);
        return { src, hits };
      } catch {
        failedSources.push(src.name);
        return { src, hits: [] as Awaited<ReturnType<ProductSource['search']>> };
      }
    }),
  );

  // 검색 결과를 라운드로빈(소스 인터리브)으로 펼치고 정규 URL로 dedup.
  // 단순 소스순 평탄화 후 상한을 적용하면 앞 소스가 슬롯을 독식해 뒤 소스(예: 해외)가 0건이 될 수 있다.
  const seenHits = new Set<string>();
  const candidates: Array<{ src: ProductSource; hit: (typeof searchResults)[number]['hits'][number] }> = [];
  const maxLen = Math.max(0, ...searchResults.map((r) => r.hits.length));
  for (let i = 0; i < maxLen; i++) {
    for (const { src, hits } of searchResults) {
      const hit = hits[i];
      if (!hit) continue;
      const key = dedupKey(hit.url, hit.title);
      if (seenHits.has(key)) continue;
      seenHits.add(key);
      candidates.push({ src, hit });
    }
  }

  // 2단계: 성공 매물 maxListings개를 채울 때까지 후보를 배치로 스크랩한다.
  // 상한을 스크랩 '전'에만 적용하면 스크랩 실패가 슬롯을 소모해 최종 매물이 상한보다 크게 모자랄 수 있다(bug22).
  // 성공분이 상한에 도달하면 멈춰 불필요한 스크랩 비용도 막는다(#7 의도 유지).
  const cap = maxListings != null ? maxListings : candidates.length;
  const listings: Listing[] = [];
  let attempted = 0;
  while (listings.length < cap && attempted < candidates.length) {
    if (signal?.aborted) break; // 연결 종료 시 남은 배치를 시작하지 않는다
    const need = cap - listings.length;
    const batch = candidates.slice(attempted, attempted + need);
    attempted += batch.length;
    const scraped = (
      await Promise.all(batch.map(({ src, hit }) => src.fetchListing(hit, scrapeHints).catch(() => null)))
    ).filter((l): l is Listing => l != null);
    listings.push(...scraped);
  }

  // 스크랩 결과도 정규 URL로 한 번 더 dedup(스크랩이 url을 정규화했을 수 있음)
  const seen = new Set<string>();
  const deduped: Listing[] = [];
  for (const l of listings) {
    const key = dedupKey(l.url, l.title) || l.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(l);
  }

  return { listings: deduped, failedSources, attempted };
}
