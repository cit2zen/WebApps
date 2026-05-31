# 🔎 ShopScout

목적을 파악해 **신뢰할 수 있는 최저가 매물**을 추천하는 채팅형 쇼핑 어드바이저.

사용자가 무엇을 왜 사는지 말하면, 국내·해외 쇼핑몰에서 매물을 수집하고
**5가지 요소(후기 진위 · 사진/정품 일치 · 가격/허위매물 · 광고/협찬 · 목적 적합성)** 를
전문 평가 에이전트 팀이 병렬로 채점하여, "신뢰 임계를 통과한 매물 중 최저가이면서
목적에 가장 부합하는" 상품을 추천한다. 모호하거나 더 합리적인 대안이 있으면 되묻는다.

## 빠른 시작 (자격증명 없이 시연)

```bash
npm install
# 목 LLM + 목 소스로 전체 플로우를 결정적으로 구동
SHOPSCOUT_LLM=mock SHOPSCOUT_SOURCES=mock npm run dev
# http://localhost:3000 → "코딩용 무선 키보드 10만원" 입력
```

Windows PowerShell:

```powershell
$env:SHOPSCOUT_LLM='mock'; $env:SHOPSCOUT_SOURCES='mock'; npm run dev
```

## 실제 구동

1. **LLM (구독 자격증명)**: Agent SDK는 Claude Code 로그인 세션의 자격증명을 사용한다.
   `claude` CLI로 로그인되어 있으면 별도 API 키 없이 동작한다.
   - `SHOPSCOUT_LLM=agent-sdk` (기본값)
   - 모델 지정: `SHOPSCOUT_MODEL=claude-...` (선택)
2. **데이터 수집**: `.env`에 firecrawl 키 설정. 없으면 해당 소스는 빈 결과로 degrade.
   ```bash
   cp .env.example .env
   # FIRECRAWL_API_KEY=...
   ```
3. `npm run dev`

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | 단위·통합 테스트 (Vitest) |
| `npm run e2e` | E2E (Playwright, 목 모드) |
| `npm run typecheck` | 타입 검사 |

## 주요 기능

- **목적 파악 대화**: 용도·예산·필수조건을 되묻고("없음"도 정상 처리), 클릭 옵션으로 빠르게 응답
- **5요소 평가 에이전트 팀**: 후기진위·사진/정품·가격/허위·광고/협찬·목적적합성을 병렬 채점
- **신뢰+예산 통과 중 최저가** 추천, 결정적 배제조건 게이트(스펙 매칭), 정보부족 감점
- **추천 이유 요약** + **카드/비교표 토글**(상위 후보 나란히)
- **동일상품 그룹핑**: 같은 제품의 더 비싼 판매처는 최저가 대표 아래로 접음
- **실시간 진행 표시**(스트리밍): 검색→평가→추천 단계 노출
- **대화 이력 복원**: 새로고침/재방문 시 직전 추천 복원
- **멀티모달 사진 검증**: 가능 시 실제 상품 이미지를 비전 평가에 첨부(ⓑ)
- **카테고리 인지 심층 평가**: 발화를 **600+노드 택소노미(31부서·570+품목)** 로 분류해 **품목별 전용 기준**으로 평가(ⓕ). 식품→영양·알레르겐·유통기한, 전자/기계→스펙표·호환·A/S·목적적합, 의류→원단·핏, 의료기기→정확도·인증 등. 택소노미에 없는 품목은 LLM이 기준을 생성·캐시(롱테일 커버). `data/taxonomy.json`
- **목적 기반 우선순위 + 세션 맞춤 기준**: 사용자 목적에 따라 기준 가중치를 재조정(1인가구 냉장고→에너지·소음 우선). 대화로 "방수도 봐줘"(기준 추가)·"가격보다 내구성 우선"(우선순위)을 말하면 그 세션에 반영. "이번에 본 기준" 표시.
- **강화된 크롤링**: 카테고리별 추출 힌트 주입, 재시도·동시성 제한·캐시·markdown 폴백, firecrawl+exa 검색 병합.
- **배송 기한**: 기한 언급 시 초과 매물 제외 / 빠른 배송 가점
- **명시적 장단점**: 각 매물에 👍 장점 · 👎 단점 도출
- **국내+해외(쿠팡·네이버·아마존·알리·테무 등)** 통합 최저가, 배송비 포함 총액 기준

## 아키텍처

하이브리드 + 평가 에이전트 팀. 자세한 설계는
[`docs/superpowers/specs/2026-05-30-shopscout-design.md`](docs/superpowers/specs/2026-05-30-shopscout-design.md),
구현 계획은 [`docs/superpowers/plans/2026-05-30-shopscout.md`](docs/superpowers/plans/2026-05-30-shopscout.md) 참고.

```
발화 → Purpose Discovery(되묻기) → Product Source(국내+해외 병렬, firecrawl/exa)
     → 평가 에이전트 팀(매물 × 5요소 병렬) → Synthesizer(랭킹·질의 트리거) → 추천/질의
```

핵심 모듈:

- `src/lib/llm/` — `LlmClient` 인터페이스, Agent SDK(구독 인증) / Dev 목 구현
- `src/lib/sources/` — `ProductSource` 인터페이스, firecrawl 래퍼, 국내·해외·목 소스
- `src/lib/purpose/` — 구매 목적 추출 + 되묻기
- `src/lib/evaluation/` — 5요소 평가 에이전트 팀
- `src/lib/recommender/` — 종합·랭킹·질의 트리거 (결정적)
- `src/lib/orchestrator/` — 한 턴 파이프라인 조립
- `src/app/` — 채팅 UI + `/api/chat`

## 한계 / 범위 밖

- 실제 결제·구매 자동화는 하지 않는다(추천·링크 제공까지).
- 단일 사용자 로컬 MVP(계정/인증 없음).
- Agent SDK의 구독 자격증명 사용은 비공식 경로로, 상시 구동 시 ToS/토큰 만료 여지가 있다.
