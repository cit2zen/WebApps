# ShopScout 향상 — 정확도 · 사용자 편의 (설계 스펙)

> 작성일: 2026-05-30
> 상태: 자율 진행 승인(2시간), 로드맵 확정

기존 ShopScout(설계: `2026-05-30-shopscout-design.md`) 위에 정확도·사용자 편의를 높이는 향상 묶음.
모든 항목은 TDD + 단계별 커밋 + 다중에이전트 리뷰로 회귀 검증한다. 기존 그린 상태(53 테스트 + 2 E2E)를 깨지 않는다.

## 우선순위 (저리스크 고가치 → 고가치 고노력)

### 편의 (Convenience)
- **E1. 질의 옵션 버튼화** — `askUser.options`를 클릭 버튼으로 렌더. 클릭 시 해당 텍스트를 발화로 전송. 순수 UI.
- **E2. 추천 이유 자연어 요약** — `Recommendation`에 `summary: string` 추가. synthesize에서 **결정적**으로 생성(1순위 매물·이유·예산/신뢰 근거·대안 유무). LLM 비의존 → 테스트 용이.
- **E3. 비교 테이블 뷰** — 상위 N개(예 3) 후보의 가격/신뢰/핵심 플래그를 나란히 보여주는 `ComparisonTable` 컴포넌트. 카드와 토글.
- **E4. 대화 이력 복원** — `GET /api/chat?turnKey=` 추가로 저장된 `lastRecommendation`/대화 상태 반환. UI는 마운트 시 turnKey가 있으면 복원.

### 정확도 (Accuracy)
- **E5. 구조화 스펙 매칭 게이트** — mustHaves/dealbreakers를 매물 specs+title 텍스트와 **결정적**으로 대조해 `mustHaveMissed[]`/`dealbreakerHit[]` 산출. ⓔ LLM 플래그와 OR로 결합해 하드 게이트 강화(둘 중 하나라도 위반이면 탈락). 비결정성 감소.
- **E6. 동일상품 그룹핑 + 최저가 대표** — 정규화 제목·가격 근접으로 같은 제품을 묶어 그룹 최저가를 대표로, 나머지는 "같은 상품 더 비싼 판매처"로 접어 보여줌. 중복 노출 감소·"더 싸게" 강화.
- **E7. 스트리밍 진행 표시(SSE)** — `/api/chat`를 단계 이벤트(검색중→평가중→추천) 스트림으로. UI가 진행 단계를 실시간 표시. 느린 파이프라인 체감 개선. 기존 JSON 계약은 최종 이벤트로 보존.

### 정확도 (타당성 확인 후)
- **E8. 멀티모달 사진 검증** — Agent SDK 이미지 입력 지원 여부를 context7로 확인. 가능하면 `LlmClient.structuredWithImages` 경로를 추가해 ⓑ만 실제 이미지로 평가. 불가하면 인터페이스만 두고 텍스트 폴백 유지(과신 금지 가드 유지). 실 LLM 없이는 mock으로만 검증.

## 데이터/계약 변경 (요약)
```ts
interface Recommendation {
  ranked: { listing; evaluation; reason; group?: string }[]; // group: 동일상품 그룹 id
  askUser?: { question; options?; reason };
  summary?: string; // E2
}
// GET /api/chat?turnKey=KEY → { intent?, lastRecommendation? } | { kind:'empty' }
// SSE: data: {stage:'searching'|'evaluating'|'done', ...}
```

## 테스트 전략
- E1/E3/E4/E7 UI·엔드포인트: Vitest(핸들러) + Playwright(목 모드) 시나리오.
- E2/E5/E6: 결정적 로직 → 순수 Vitest 단위 테스트(골든 케이스).
- E8: MockLlmClient로 이미지 경로 분기 검증, 실경로는 가드.

## 비범위 (YAGNI)
- 외부 시세/가격이력 API, 결제, 멀티유저 인증/세션, 알림.

## 빌드 순서
E1 → E2 → E3 → E4 → E5 → E6 → E7 → (E8 타당성 확인 후 결정). 각 단계 커밋, 2~3단계마다 리뷰 워크플로우.
