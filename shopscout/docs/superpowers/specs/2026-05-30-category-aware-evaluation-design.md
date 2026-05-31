# ShopScout — 카테고리 인지 심층 평가 (설계 스펙)

> 작성일: 2026-05-30
> 상태: 승인됨 (C안: 큐레이션 코어 + 동적 롱테일). 하위 프로젝트로 분해 진행.

## 목적

세상의 모든 상품을 세세한 품목으로 분류하고, **품목별 전용 평가 기준**으로 심층 평가한다.
식품→영양·효능·대체·알레르겐, 의약/건기식→성분·함량·주의, 전자/기계→스펙표·목적 적합, 의류→원단·핏·관리 등
카테고리마다 다른 기준을 적용한다. 더불어 배송 기한, 명시적 장단점, 테무 소스, 카테고리별 심층 스크래핑을 더한다.

## 전체 전략 (C안)

"모든 상품"을 정적으로 손으로 적는 것은 비현실적이므로 **하이브리드**로 달성한다:
- **큐레이션 코어**: 흔한 부서·하위 카테고리의 풍부한 평가 기준을 명시적으로 정의한 택소노미 DB. agent team으로 생성.
- **동적 롱테일**: 택소노미에 없는 품목은 런타임에 LLM이 기준을 생성하고 캐시(한 번 생성 후 재사용). → 사실상 무한 커버.

## 데이터 모델

```ts
interface CriterionDef {
  key: string;           // "원단_혼용률"
  label: string;         // "원단 혼용률"
  check: string;         // 평가자에게 주는 구체 지시(무엇을 어떻게 보는지)
  dataNeeded: string[];  // 스크랩에서 필요한 필드 힌트(예: ["혼용률","두께"])
  weight: number;        // 0~1 상대 가중치
  redFlags: string[];    // 이 신호가 보이면 위험(예: ["혼용률 미표기"])
}
interface TaxonomyNode {
  id: string;            // "food.supplement" (점 경로 = 계층)
  name: string;          // "건강기능식품"
  parent?: string;       // "food"
  keywords: string[];    // 분류 매칭 힌트
  criteria: CriterionDef[];
  scrapeHints: string[]; // 카테고리별 스크랩 추출 항목(영양성분표/스펙표/원단 등)
}
interface Taxonomy { version: string; nodes: TaxonomyNode[]; }
```

`data/taxonomy.json` 에 저장. 기준은 부모→자식 상속(자식이 추가·덮어쓰기).

## 컴포넌트 (단일 책임)

1. **Taxonomy DB** (`data/taxonomy.json`) — agent team이 부서별 병렬 생성. 부서 예: 전자·가전, 컴퓨터·주변기기, 식품·신선, 건강기능식품·의약외품, 뷰티·퍼스널케어, 패션·의류, 신발·잡화, 가구·인테리어, 주방·생활, 유아·출산, 반려동물, 스포츠·레저, 도서·미디어, 자동차·공구, 사무·문구 등.
2. **Taxonomy 로더/리졸버** (`src/lib/taxonomy/`) — JSON 로드, id로 노드+조상 기준 병합 반환. 미지 노드는 동적 생성기에 위임.
3. **Category Classifier** (`src/lib/taxonomy/classify.ts`) — intent/발화 → 노드 id (LLM, 노드 목록 제공, 캐시). 매칭 실패 시 가장 가까운 부서 + 동적 리프 생성.
4. **Dynamic Rubric Generator** (`src/lib/taxonomy/dynamic.ts`) — 미지 품목의 CriterionDef[]를 LLM 생성, Store에 캐시(품목 키별 1회).
5. **Category Evaluator (ⓕ)** (`src/lib/evaluation/category.ts`) — 해결된 rubric으로 매물을 평가. 기준별 점수·근거·레드플래그 → 종합. 기존 5요소(ⓐ~ⓔ)에 ⓕ 추가, 또는 ⓔ를 rubric 주입형으로 강화.
6. **카테고리별 스크래핑** — firecrawl PRODUCT_SCHEMA를 기본 + scrapeHints로 확장(영양성분표/상세스펙표/원단·혼용률/배송 예상일 추출).
7. **부가**: 배송기한(`deliveryDays` 수집·평가), 장단점(`pros[]`/`cons[]` 구조화), 테무 소스(globalSource에 temu.com 추가).

## 데이터/타입 변경

```ts
// Listing 확장
interface Listing {
  // ...기존
  deliveryDays?: number;          // 배송 예상 소요일
  nutrition?: Record<string,string>; // 영양성분(식품)
  detailedSpecs?: Record<string,string>; // 상세 스펙(전자/기계)
  material?: Record<string,string>;  // 원단/소재(의류)
  categoryId?: string;            // 분류 결과
}
// 평가 결과에 장단점
interface RankedItem { /* ...기존 */ pros?: string[]; cons?: string[]; }
// PurchaseIntent에 분류·배송요건
interface PurchaseIntent { /* ...기존 */ categoryId?: string; maxDeliveryDays?: number; }
```

## 데이터 흐름 (추가분)

```
intent → Category Classifier → categoryId
       → Taxonomy Resolver(categoryId) → 병합 rubric (없으면 Dynamic Generator+캐시)
       → 카테고리별 scrapeHints로 수집 강화
       → 평가팀(ⓐ~ⓔ) + ⓕ 카테고리 전문평가(rubric 기반)
       → 장단점 추출 + 배송기한 반영 → 종합/랭킹
```

## 에러 처리
- 분류 실패 → 범용(general) 노드 기준으로 폴백.
- 동적 생성 실패 → 부서 기준만 사용.
- 카테고리 데이터(영양표 등) 부재 → 해당 기준 dataInsufficient 처리(감점, 환각 금지).

## 테스트
- 택소노미 로더/리졸버(상속 병합), 분류기(목 LLM), 동적 생성기(캐시), ⓕ 평가자(rubric→점수), 장단점/배송기한 결정적 로직 — 모두 Vitest.
- 골든 케이스: 식품(영양·알레르겐), 전자(스펙·목적), 의류(원단) 각 1.
- E2E: 카테고리별 추천 흐름 1.

## 하위 프로젝트(빌드 순서)
1. **택소노미 DB 생성** (agent team 워크플로우) — `data/taxonomy.json` 산출 + 스키마 검증.
2. **로더·리졸버·분류기·동적생성기** (TDD).
3. **카테고리 평가자 ⓕ + 카테고리별 스크래핑 스키마** (TDD).
4. **부가 4종**: 배송기한, 장단점, 테무, 심층 스크래핑 통합.

각 하위 프로젝트는 독립 동작·테스트 가능. 단계마다 커밋 + 다중에이전트 리뷰.

## 비범위 (YAGNI)
- 실시간 외부 영양/의약 DB 연동(추후). 의료 면책: 건강 관련은 정보 제공일 뿐 의학적 조언 아님을 명시.
