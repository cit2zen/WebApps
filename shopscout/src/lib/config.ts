/** 운영 튜닝값 중앙화 — 흩어진 env 파싱·매직넘버를 한곳에서 관리 */
function num(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export const config = {
  /** 한 턴에서 평가하는 매물 상한 (LLM 호출·스크랩 비용 제어) */
  maxListings: num('SHOPSCOUT_MAX_LISTINGS', 12),
  /** 소스당 검색 결과 수 */
  perSource: num('SHOPSCOUT_PER_SOURCE', 6),
  /** LLM 동시 호출 상한 */
  llmConcurrency: num('SHOPSCOUT_LLM_CONCURRENCY', 6),
  /** 스크랩 동시 호출 상한 */
  scrapeConcurrency: num('SHOPSCOUT_SCRAPE_CONCURRENCY', 4),
  /** 발화 최대 길이(DoS 방어) */
  maxUtteranceLength: num('SHOPSCOUT_MAX_UTTERANCE', 2000),
};
