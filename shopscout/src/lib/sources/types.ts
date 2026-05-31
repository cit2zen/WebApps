import type { Listing, PurchaseIntent } from '@/lib/types';

export interface SearchHit {
  url: string;
  title: string;
  marketplace: string;
  /** 검색 노출 순위(0-base) — 광고·협찬(ⓓ) 평가용 */
  searchRank?: number;
  isSponsored?: boolean;
}

export interface ProductSource {
  name: string;
  search(intent: PurchaseIntent, limit: number): Promise<SearchHit[]>;
  /** hints: 카테고리별로 꼭 추출할 항목(scrapeHints) — 스크랩 정확도 향상 */
  fetchListing(hit: SearchHit, hints?: string[]): Promise<Listing>;
}
