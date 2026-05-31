# ShopScout — 지능형 구매 추천 서치 웹앱 (설계 스펙)

> 작성일: 2026-05-30
> 상태: 승인됨 (브레인스토밍 완료)

## 1. 목적

사용자가 사고 싶은 것을 말하면, **진짜 구매 목적을 파악**하고 국내·해외 쇼핑몰에서
매물을 수집·분석하여 **"가장 저렴하면서도 신뢰할 수 있고, 목적에 가장 부합하는"** 상품을
추천하는 채팅형 웹앱. 온라인 구매 시 고려해야 할 모든 요소(광고/협찬, 허위매물, 평점,
사용후기, 사진, 정품·사양 일치, 구매 합리성)를 평가에 반영한다. 모호하거나 더 합리적인
대안이 있을 때는 사용자와의 질의를 통해 추천을 좁혀 나간다.

## 2. 핵심 원칙

- **목적 우선**: 제품명이 아니라 "왜 사는지"(용도·맥락·제약)를 먼저 파악한다.
- **신뢰 임계 후 최저가**: 신뢰 기준을 통과한 매물 중 최저가를 고른다. 싸지만 위험하면 탈락.
- **합리성 검증**: 요청한 제품보다 목적에 더 맞는 대안/제품군이 있으면 제안한다(최종 선택은 사용자).
- **모호하면 질의**: 우열이 모호하거나 더 나은 대안이 있을 때 사용자에게 되묻는다.
- **요소별 전문 평가**: 평가는 요소별 전문 에이전트가 병렬로 수행하고 종합한다.

## 3. 기술 스택

- **프런트엔드/풀스택**: Next.js 16 (App Router, TypeScript). 채팅 UI + API Routes/Server Actions.
- **AI 백엔드**: Claude Agent SDK — **구독 자격증명(Claude Code OAuth)** 으로 호출. 별도 API 과금 없음.
  - 비공식 경로(상시 구동 시 ToS/토큰 만료 여지). 홈서버 프로젝트 범위로 수용.
  - AI 호출은 `LlmClient` 인터페이스 뒤에 추상화하여 추후 교체 가능하게 한다.
- **데이터 수집**: firecrawl(검색·스크랩) + exa(검색). 국내(쿠팡/네이버쇼핑/11번가 등) + 해외(Amazon 등).
- **저장**: MVP는 SQLite(better-sqlite3). `Store` 인터페이스로 추상화하여 추후 홈서버 Postgres로 이관 가능.
- **패키지 매니저**: npm (pnpm 미설치 환경).
- **테스트**: Vitest(단위/통합) + Playwright(E2E).

## 4. 아키텍처 (하이브리드 + 평가 에이전트 팀)

```
사용자 발화
   │
   ▼
[Purpose Discovery] ── 핵심 슬롯(예산·용도·필수조건·사용맥락) 부족 시 한 번에 하나씩 되묻기
   │  (확정된 PurchaseIntent)
   ▼
[Product Source].search()  ── 국내 + 해외 병렬 (firecrawl/exa)
   │  (후보 목록)
   ▼
[Product Source].fetchListing()  ── 후보 N개 상세 스크랩
   │  (정규화된 Listing[])
   ▼
[Evaluation Agent Team]  ── 매물 × 5요소 병렬 fan-out, 각 요소 구조화 출력(JSON)
   │  (요소별 점수·플래그·근거·신뢰도)
   ▼
[Synthesizer / Recommender]  ── 점수 종합 → 랭킹("신뢰 통과 중 최저가 + 목적부합")
   │
   ├─ 명확 → 추천 카드 표시
   └─ 모호/더 나은 대안/최저가 탈락 → 사용자에게 질의 → 목적 갱신 후 재랭킹
```

## 5. 컴포넌트 (단일 책임 · 독립 테스트 가능)

1. **Chat UI** (`app/`, `components/`) — 메시지 스트림, 되묻기 프롬프트, 상품 비교 카드, 평가 근거 펼치기.
2. **Conversation Orchestrator** (`lib/orchestrator/`) — 대화 상태·턴 관리, 다음에 호출할 모듈 결정, 스트리밍 응답.
3. **Purpose Discovery** (`lib/purpose/`) — 발화 → `PurchaseIntent` 추출, 부족 슬롯 식별·되묻기 생성.
4. **Product Source** (`lib/sources/`) — `ProductSource` 인터페이스(`search`, `fetchListing`). 국내·해외 구현체를 firecrawl/exa 뒤에 캡슐화. 폴백 지원.
5. **Evaluation Agent Team** (`lib/evaluation/`) — 5개 평가자(아래 §6). 공통 `Evaluator` 인터페이스, 병렬 실행기.
6. **Synthesizer / Recommender** (`lib/recommender/`) — 요소 점수 종합·가중, 랭킹, 질의 트리거 판정.
7. **Store** (`lib/store/`) — 대화·후보·평가 결과 영속화(SQLite, 인터페이스 추상화).
8. **LlmClient** (`lib/llm/`) — Agent SDK 래퍼. 구조화 출력(JSON 스키마) 호출, 재시도·백오프.

## 6. 평가 요소 (각 매물 → 0~100 점수 + 플래그[] + 근거 + 신뢰도 0~1)

| 코드 | 요소 | 주요 판정 신호 |
|---|---|---|
| ⓐ | 후기 진위 | 후기 수/별점 분포(5점 몰림), 텍스트 다양성, 동일문구 반복, 단기 폭증, 사진후기 비율 |
| ⓑ | 사진·정품/사양 일치 | 대표사진 스톡/도용 여부, 사진 속 모델명·사양이 요청과 일치, 정품/병행/리퍼 표기 |
| ⓒ | 가격·허위매물 | 시세 대비 비정상 저가, 배송비/옵션가 함정, 재고·판매자 신뢰도, 미끼가 의심 |
| ⓓ | 광고·협찬 | 스폰서/파워링크 표기, 협찬 후기 패턴, 상위노출=품질 아님 보정 |
| ⓔ | 목적 적합성·합리성 | 목적 대비 과/부족 스펙, 더 싼 동급 대안, 다른 제품군이 목적에 더 맞는지 |

- 각 평가자는 전문 시스템 프롬프트 + 구조화 출력(JSON)으로 점수·플래그·근거·신뢰도를 반환.
- 종합 점수 = 요소 점수의 신뢰도 가중 합. **목표 함수: 신뢰 임계 통과 매물 중 최저가.**
- 데이터 부족(후기 0 등)은 점수 대신 "정보 부족" 플래그 → 추천에서 감점.

## 7. 대화 / 합리성 로직

- **되묻기**: Purpose Discovery가 핵심 슬롯을 못 채우면 한 번에 하나씩 질문.
- **질의 트리거 (Synthesizer)**: ① 후보 간 점수 근소차(우열 모호) ② 목적상 더 합리적인 대안/제품군 존재 ③ 위험 플래그로 최저가 후보가 탈락해 확인 필요.
- **합리성 점검**: "요청=X지만 목적엔 Y가 더 맞음"을 근거와 함께 제시하되 최종 선택은 사용자.

## 8. 핵심 데이터 모델 (요약)

```ts
interface PurchaseIntent {
  rawQuery: string;
  category?: string;
  budgetKRW?: { min?: number; max?: number };
  useCase?: string;            // 사용 목적/맥락
  mustHaves: string[];         // 필수 조건
  niceToHaves: string[];
  dealbreakers: string[];
  missingSlots: string[];      // 아직 못 채운 핵심 슬롯
}

interface Listing {
  id: string;
  source: 'kr' | 'global';
  marketplace: string;         // 쿠팡, 네이버, Amazon ...
  url: string;
  title: string;
  priceKRW: number;
  shippingKRW?: number;
  seller?: string;
  rating?: number;
  reviewCount?: number;
  images: string[];
  rawSpecs: Record<string, string>;
  raw: unknown;                // 원본 스크랩 데이터
}

interface FactorResult {
  code: 'a' | 'b' | 'c' | 'd' | 'e';
  score: number;               // 0~100
  confidence: number;          // 0~1
  flags: string[];
  rationale: string;
}

interface Evaluation {
  listingId: string;
  factors: FactorResult[];
  trustScore: number;          // 종합 신뢰
  passesTrustThreshold: boolean;
}

interface Recommendation {
  ranked: { listing: Listing; evaluation: Evaluation; reason: string }[];
  askUser?: { question: string; options?: string[]; reason: string };
}
```

## 9. 에러 처리

- **스크랩 차단/타임아웃** → 소스 폴백(국내↔해외, firecrawl↔exa), 부분 결과로 진행 + "일부 소스 누락" 표기.
- **Claude 호출 실패/레이트리밋** → 재시도 + 지수 백오프. 평가 요소 일부 실패 시 해당 요소 제외하고 신뢰도 하향.
- **데이터 부족** → "정보 부족" 플래그, 추천에서 감점(점수 0 처리 아님).
- 모든 외부 호출은 타임아웃·에러를 `Result`/예외로 감싸고 사용자에게 사실대로 표기.

## 10. 테스트 전략 (TDD)

- **수집 레이어**: `ProductSource`를 저장된 픽스처(HTML/JSON)로 단위 테스트 — 네트워크 비의존.
- **평가 에이전트**: 픽스처 매물 입력 → 출력 스키마·플래그 검증. 골든 케이스(명백한 허위매물/협찬/스톡사진 샘플)로 회귀 방지. LLM 호출은 `LlmClient` 목으로 결정화.
- **Synthesizer**: 점수표 입력 → 랭킹·질의 트리거 로직 결정적 테스트(LLM 비의존).
- **E2E**: 채팅 시나리오 1개(Playwright) — 발화 → 되묻기 → 추천 카드.

## 11. 빌드 순서 (단계별, 각 단계 동작 확인)

1. **스캐폴드**: Next.js 16 + TS + Vitest + 채팅 UI 골격 + `LlmClient`(Agent SDK 구독 인증) "핑" 왕복.
2. **수집 레이어**: `ProductSource` 인터페이스 + firecrawl/exa 국내·해외 검색·스크랩 (픽스처 테스트).
3. **Purpose Discovery** + 되묻기 루프.
4. **Evaluation Agent Team**: 5요소 병렬 + 구조화 출력.
5. **Synthesizer**: 랭킹·질의 트리거 + 상품 비교 카드 UI.
6. **마감**: 에러처리·폴백·영속화, E2E.

각 단계는 가능한 한 subagent/workflow로 병렬 진행하여 품질을 높인다.

## 12. 범위 밖 (YAGNI)

- 실제 결제/구매 자동화(추천까지만, 구매 링크 제공).
- 사용자 계정/인증(MVP는 단일 사용자 로컬).
- 모바일 앱, 알림, 가격 추적 히스토리(추후 단계).
