# ShopScout 전체 보강 계획 (audit 기반)

> 작성일: 2026-05-30
> 8관점 다중에이전트 audit(36건) 기반. 우선순위 1→5 순차 실행. 각 배치 TDD + 리뷰 + 커밋.

## 1순위 — 도메인 핵심 (추천 품질 직결)
- **R1. ⓕ 기준별 점수화**(#1·#21): category.ts가 criterionScores[]({key,score,confidence,dataInsufficient,flags}) 반환 → 코드에서 weight 가중합으로 ⓕ score 결정적 계산. prioritizeRubric의 가중치가 실제 반영 + 설명가능성.
- **R2. 요소별 도메인 가중치**(#2): trustScore에 factor domainWeight 도입(ⓕ·ⓔ 상향), 상수 노출.
- **R3. 랭킹 결합·tie-break**(#3·#24): 순수 최저가 → (가격, ⓒ가격적정성, trustScore) 결합/사전식. priceContext median 대비 할인율 노출.
- **R4. 카테고리 redFlags·필수조건 하드 게이트**(#25·#26): ⓕ 구조화 flags를 게이트 반영, mustHave 결정적 미충족 보조 게이트, pros/cons에 기준별 근거.

## 2순위 — 배포/실연동
- **R5. Agent SDK 인증 분기**(#4): API키/CLI 경로 선택 + 시작 헬스체크 fail-fast + 문서 경고.
- **R6. 레이트리밋·에러·비용 관측**(#5·#36): rate_limit_event/is_error/subtype 처리, 비재시도성 에러 즉시 throw.
- **R7. 검색 includeDomains 네이티브화**(#27), isSponsored→adLabel 일원화(#28), 스크랩 빈결과 검증·미캐시·statusCode(#29).

## 3순위 — 성능·비용
- **R8. 6요소 1콜 병합**(#6): 매물당 ⓐ~ⓕ를 단일 구조화 호출로(72→12콜). classify 캐시.
- **R9. 모델 티어링·스크랩 cap**(#7): 경량 모델 옵션, 스크랩 전 dedup/cap. config 중앙화(#18).

## 4순위 — 보안·관측성
- **R10. DoS 방어**(#8): 요청 레이트리밋, utterance 길이 cap, MAX_LISTINGS 재검토.
- **R11. 세션/저장 보안**(#30): turnKey 쿠키 세션+TTL 옵션, DB 디렉터리 제한.
- **R12. 관측성**(#12·#13·#14): 단계 타이밍·턴당 토큰/비용·실패율 메트릭, 전소스 실패 vs 빈결과 구분, 침묵 실패 카운터.

## 5순위 — 테스트·정확성·아키텍처
- **R13. 테스트 보강**(#9·#10·#11·#32): ⓕ 골든, 전 파이프라인 통합, SDK 계약(vi.mock), 멀티턴/되묻기 E2E.
- **R14. 정확성 수치**(#20·#22·#23·#34·#35): searchRank offset, parseDeliveryDays 일단위, 표준요소 인프라실패 coverage 제외, hasAlternative code!=='f', 캐시 TTL/LRU.
- **R15. 아키텍처 정리**(#15·#16·#17·#19·#33): team.ts 분리(score.ts), sanitize/canonicalUrl 공통화, ⓕ 스키마 통일, 죽은 categoryId 제거.

## 실행 원칙
- 각 배치 TDD, 전체 그린(테스트+E2E+build+tsc) 유지, 배치마다 다중에이전트 리뷰로 회귀 검증.
- 독립 leaf는 subagent 병렬, 상호의존 핵심은 직접.
