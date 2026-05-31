// 공용 도메인 타입

export interface PurchaseIntent {
  rawQuery: string;
  category?: string;
  budgetKRW?: { min?: number; max?: number };
  useCase?: string;
  mustHaves: string[];
  niceToHaves: string[];
  dealbreakers: string[];
  /** 사용자가 "필수조건 없음"을 명시적으로 확인함 (빈 mustHaves가 정당한 종료 상태임을 표시) */
  mustHavesConfirmed?: boolean;
  /** 배송 기한(일) — 이보다 늦으면 통과 티어에서 제외 */
  maxDeliveryDays?: number;
  /** 사용자가 대화로 추가한 평가 특성(예: "배터리 수명","방수") — 세션 누적 */
  extraCriteria: string[];
  /** 사용자가 말한 우선순위 힌트(예: "가격보다 내구성 우선") — 세션 누적 */
  priorityHints: string[];
  missingSlots: string[];
}

export interface ReviewSample {
  text: string;
  rating?: number;
  date?: string;
  hasPhoto?: boolean;
}

export interface Listing {
  id: string;
  source: 'kr' | 'global';
  marketplace: string;
  url: string;
  title: string;
  priceKRW: number;
  shippingKRW?: number;
  seller?: string;
  rating?: number;
  reviewCount?: number;
  images: string[];
  rawSpecs: Record<string, string>;
  /** 후기 진위(ⓐ) 평가용 표본 */
  reviews?: ReviewSample[];
  /** 별점 분포 (예: {"5": 900, "4": 200, ...}) */
  ratingHistogram?: Record<string, number>;
  /** 광고·협찬(ⓓ) 평가용: 검색 노출 순위 / 스폰서 표기 */
  searchRank?: number;
  isSponsored?: boolean;
  adLabel?: string;
  /** 배송 예상 소요일 (부가) */
  deliveryDays?: number;
  /** 카테고리별 심층 데이터 (식품 영양 / 전자 상세스펙 / 의류 소재) */
  nutrition?: Record<string, string>;
  detailedSpecs?: Record<string, string>;
  material?: Record<string, string>;
  raw: unknown;
}

export type FactorCode = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

export interface CriterionScore {
  key: string;
  label?: string;
  score: number; // 0~100
  confidence: number; // 0~1
  weight?: number; // 적용된 가중치(설명용)
  dataInsufficient?: boolean;
  flags: string[];
}

export interface FactorResult {
  code: FactorCode;
  score: number; // 0~100
  confidence: number; // 0~1
  flags: string[];
  rationale: string;
  /** 데이터 부족으로 근거 없이 채점했음 (감점 대상) */
  dataInsufficient?: boolean;
  /** 목적 적합성(ⓔ) 전용: 필수조건 충족 / 절대 배제조건 위반 */
  mustHaveMet?: boolean;
  dealbreakerHit?: boolean;
  /** 인프라(LLM 호출) 실패 — 데이터 부족과 구분(coverage 분모 제외용) */
  infraFailure?: boolean;
  /** 카테고리(ⓕ) 전용: 기준별 점수 (설명가능성·결정적 가중합) */
  criterionScores?: CriterionScore[];
}

export interface Evaluation {
  listingId: string;
  factors: FactorResult[];
  trustScore: number;
  passesTrustThreshold: boolean;
}

export interface RankedItem {
  listing: Listing;
  evaluation: Evaluation;
  reason: string;
  /** 결정적으로 도출한 장점/단점 (E2) */
  pros?: string[];
  cons?: string[];
  /** 동일상품 그룹 id (E6) — 같은 제품의 더 비싼 판매처는 대표 아래로 접힘 */
  group?: string;
  /** 이 매물이 더 싼 대표 매물의 중복이면 대표의 listing.id (E6) — UI에서 접음 */
  duplicateOf?: string;
  /** 대표 매물에 묶인 더 비싼 동일상품 수 (E6) */
  cheaperThanGroupCount?: number;
}

export interface Recommendation {
  ranked: RankedItem[];
  askUser?: { question: string; options?: string[]; reason: string };
  /** 추천 이유 자연어 요약 (E2, 결정적 생성) */
  summary?: string;
  /** 이 목적에서 어떤 평가 기준을 우선했는지 설명 (목적 기반 우선순위) */
  priorityNote?: string;
  /** 이번 세션에서 실제로 본 평가 기준 라벨 목록 (UI 표시용) */
  appliedCriteria?: string[];
  /** 모든 소스가 실패해 결과가 빈 경우(진짜 0건과 구분) */
  degraded?: boolean;
}

export function emptyIntent(rawQuery: string): PurchaseIntent {
  return {
    rawQuery,
    mustHaves: [],
    niceToHaves: [],
    dealbreakers: [],
    extraCriteria: [],
    priorityHints: [],
    missingSlots: [],
  };
}

export function totalPrice(l: Pick<Listing, 'priceKRW' | 'shippingKRW'>): number {
  return l.priceKRW + (l.shippingKRW ?? 0);
}
