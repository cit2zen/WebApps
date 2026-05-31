# Project JARVIS — 음성 대화형 AI (설계 문서)

- **작성일**: 2026-05-31
- **위치**: `C:\factory\Web\Jarvis`
- **상태**: 설계 확정 (사용자 승인 완료)

## 1. 개요

자비스(JARVIS)처럼 사용자의 음성에 실시간으로 반응하고, 화려한 WebGL 그래픽으로
상태를 표현하는 음성 대화형 AI 웹앱. 두뇌는 Claude(Agent SDK 구독 인증),
음성 입출력은 브라우저 네이티브, 그래픽은 react-three-fiber 기반 오브+파티클 네뷸라.

### 핵심 경험
1. 사용자가 말한다 → 오브가 마이크 음성에 실시간 반응(듣는 중)
2. Claude가 추론·도구사용 → 입자가 응축·공전(사고 중)
3. 답변을 음성으로 말한다 → 입자 방출·맥동(답변 중)
4. 끝나면 느린 호흡으로 대기(idle)

## 2. 기술 스택 결정 사항

| 항목 | 결정 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router, TypeScript) | 단일 풀스택 앱 |
| 두뇌 | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | **구독 인증**(OAuth), 별도 API 키·종량제 없음 |
| 음성 인식(STT) | 브라우저 Web Speech API (`webkitSpeechRecognition`) | 무료, `ko-KR`, 저지연 |
| 음성 합성(TTS) | 브라우저 `speechSynthesis` | 무료, 인터페이스 뒤에 두어 교체 가능 |
| 그래픽 | react-three-fiber + three.js + @react-three/postprocessing(bloom) | 오브+네뷸라, GPU 파티클 |
| 오디오 분석 | Web Audio API `AnalyserNode` | 마이크 FFT → 진폭/주파수 |
| 서버↔클라 | SSE(서버→클라 스트림) + POST(클라→서버 메시지/abort) | WS 불필요 |
| 상태 관리 | zustand(이산 상태) + mutable ref(고빈도 오디오 데이터) | 60fps 리렌더 방지 |
| 테스트 | Vitest(단위) + Playwright(시각 확인) | |
| 언어 | 한국어 메인 (영어 용어 이해) | |
| 환경 | 로컬 데스크톱 우선 | Chrome/Edge |

## 3. 아키텍처

```
┌─────────────────────────── 브라우저 (클라이언트) ───────────────────────────┐
│  🎤 마이크 ─→ useMicAnalyser (AnalyserNode, RMS/주파수)                      │
│              ─→ VoiceController (webkitSpeechRecognition, ko-KR)             │
│                    │ 최종 텍스트                                              │
│                    ▼                                                          │
│  useAgentStream ──POST /api/chat (history)──────────────┐                    │
│       ▲                                                  │                    │
│       └──── SSE: state | text | tool | subagent | done ◀─┘                    │
│       │                                                                       │
│       ├─→ appStore(zustand): state = idle|listening|thinking|speaking         │
│       ├─→ useSpeechSynth: 문장 단위 TTS, onboundary → 단어 리듬                │
│       └─→ JarvisScene (R3F): state + amplitude(ref) → 셰이더/파티클            │
│  ↩ 끼어들기: 말 감지 + 진폭 게이트 → TTS cancel + fetch abort → listening      │
└──────────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────── Next.js 서버 (Node 런타임) ───────────────────────┐
│  POST /api/chat  (export const runtime = 'nodejs')                            │
│     └─ lib/agent.ts: Agent SDK query()                                        │
│          - 구독 인증, JARVIS 한국어 시스템 프롬프트                            │
│          - 도구: WebSearch(내장) + time + memory(파일)                         │
│          - 서브에이전트(리서치 팀) 정의                                        │
│          - 세션 resume으로 대화 맥락 유지                                      │
│          - 스트림 → SSE 이벤트로 변환                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 4. 컴포넌트 (단일 책임 단위)

각 단위는 "무엇을 하는가 / 어떻게 쓰는가 / 무엇에 의존하는가"가 명확해야 한다.

### 클라이언트
- **`lib/store.ts`** — zustand 스토어. 이산 앱 상태(`idle|listening|thinking|speaking`),
  대화 히스토리, 현재 응답 텍스트. 고빈도 오디오 진폭은 별도 mutable ref로 관리(리렌더 회피).
- **`hooks/useMicAnalyser.ts`** — getUserMedia → MediaStreamSource → AnalyserNode.
  RAF 루프에서 RMS 진폭·주파수 밴드를 ref에 기록. R3F의 `useFrame`이 이 ref를 샘플링.
- **`components/VoiceController.tsx`** — `webkitSpeechRecognition` 래퍼. continuous=true,
  interimResults=true, lang=ko-KR. 최종 발화 → `useAgentStream.send()`. 발화 시작 감지 +
  진폭 게이트로 끼어들기 트리거.
- **`hooks/useSpeechSynth.ts`** — `speechSynthesis` 래퍼. 문장 청크 큐 순차 재생,
  `onboundary` 이벤트로 단어 리듬 신호 emit, `cancel()`로 중단. `lib/tts.ts` 인터페이스 구현.
- **`lib/tts.ts`** — `TextToSpeech` 인터페이스(speak/cancel/onWordBoundary). 기본 구현은
  브라우저, 추후 ElevenLabs 구현으로 교체 가능.
- **`hooks/useAgentStream.ts`** — `/api/chat` SSE 구독. 이벤트 파싱 → 스토어 상태 전환 +
  텍스트 누적 + TTS 큐잉. AbortController 보유(끼어들기/중단용).
- **`components/JarvisScene.tsx`** (R3F) — `<Canvas>` 내부 오브+네뷸라. props/스토어에서
  `state` 읽고, ref에서 `amplitude` 읽어 `useFrame`으로 셰이더 유니폼·파티클 구동.
  Bloom 포스트프로세싱으로 글로우.
  - **`Orb.tsx`** — 중심 구체. 상태별 색/스케일/맥동.
  - **`Nebula.tsx`** — GPU 파티클(인스턴싱). 상태별 응축/방출/공전.
- **`components/StatusOverlay.tsx`** — (선택) 자막·도구사용 알림 등 최소 UI.

### 서버
- **`app/api/chat/route.ts`** — POST 핸들러, Node 런타임. body=`{sessionId, message}`.
  `lib/agent.ts` 호출, 스트림을 SSE로 중계. AbortSignal 연결.
- **`lib/agent.ts`** — Agent SDK 래퍼. query() 구성·실행, 메시지 스트림을 표준 이벤트로 정규화.
- **`lib/persona.ts`** — JARVIS 시스템 프롬프트(한국어, 간결·정중·약간의 위트).
- **`lib/tools/time.ts`** — 현재 시간/날짜 도구.
- **`lib/tools/memory.ts`** — 파일 기반 메모리(`data/memory.json`) 읽기/쓰기 도구.

## 5. 데이터 흐름 (한 턴)

1. 사용자 발화 → STT 최종 텍스트 확정
2. 클라 → `POST /api/chat { sessionId, message }`
3. 서버: Agent SDK `query({ resume: sessionId, prompt: message, ... })` 스트리밍 시작
4. 서버 → SSE:
   - 추론/도구사용 구간 → `event: state, data: "thinking"`
   - 첫 텍스트 델타 → `event: state, data: "speaking"` + `event: text, data: <delta>`
   - 도구 호출 → `event: tool, data: <name>`
   - 서브에이전트 활동 → `event: subagent, data: <info>`
   - 종료 → `event: done`
5. 클라: 상태 전환(비주얼) + 텍스트 누적 + **문장이 완성될 때마다** TTS 큐에 투입
6. TTS 재생 완료 + 스트림 done → `idle`

## 6. 도구 + 에이전트 팀

- **내장 도구**: WebSearch(Agent SDK 내장), `time`, `memory`(파일 기반 "나를 기억").
- **에이전트 팀**: 무겁고 폭넓은 조사 질문에 대해 오케스트레이터(메인 Claude)가
  **병렬 리서치 서브에이전트**를 Agent SDK의 서브에이전트 기능으로 spawn.
  - JARVIS가 "조사 팀을 가동하겠습니다" 식의 멘트
  - 네뷸라에 보조 코어(서브에이전트 수만큼) 잠시 표시 → 종합 후 소멸
  - 결과를 종합해 단일 음성 답변으로 전달
- 트리거: 단순 대화/사실질의는 단독 처리, "조사/비교/리서치" 성격이면 팀 가동(시스템 프롬프트로 판단 위임).

## 7. JARVIS 페르소나

- 한국어 메인, 간결하고 정중하며 약간의 위트.
- 음성 대화이므로 **짧고 명료한 문장** 우선(긴 목록·마크다운 지양).
- 사용자를 정중히 호칭. 도구·에이전트 팀 가동 시 한 마디로 알림.

## 8. 에러 처리 / 엣지 케이스

- **미지원 브라우저**: Web Speech 미지원(예: Firefox) → 안내 화면, Chrome/Edge 권장.
- **마이크 권한 거부**: 명확한 안내 + 재요청 버튼.
- **TTS→마이크 에코**: 답변 중 마이크가 TTS를 주워 오인 끼어들기 발생 가능.
  완화책: 끼어들기는 **발화 시작 + 진폭 임계치 초과가 150ms 이상 지속**될 때만 트리거.
  헤드폰 사용 권장(문서화).
- **speechSynthesis 장문 끊김**(Chrome 알려진 버그): **문장 단위 청킹**으로 회피.
- **네트워크/스트림 중단**: 에러 이벤트 → idle 복귀 + 짧은 음성/시각 알림.
- **끼어들기**: `speechSynthesis.cancel()` 즉시 + `AbortController.abort()` → listening 전환.
- **Korean voice 미존재**: 사용 가능한 voice 중 ko-KR 우선, 없으면 기본 voice + 경고.

## 9. 테스트 전략

- **단위(Vitest)**: 상태 머신 전이, SSE 이벤트 파서, TTS 문장 청커, 진폭(RMS) 계산,
  끼어들기 게이트 로직, memory 도구 read/write.
- **시각 확인(Playwright)**: 앱 구동 후 각 상태(idle/listening/thinking/speaking)
  스크린샷으로 비주얼 회귀 확인. R3F 내부는 단위테스트 대신 시각 확인.
- TDD: 로직 단위는 테스트 먼저 작성 후 구현.

## 10. 파일 구조 (예정)

```
C:\factory\Web\Jarvis\
  app/
    page.tsx                 # 메인 (Canvas + VoiceController)
    layout.tsx
    api/chat/route.ts        # SSE 스트리밍 (Node 런타임)
  components/
    JarvisScene.tsx
    Orb.tsx
    Nebula.tsx
    VoiceController.tsx
    StatusOverlay.tsx
  hooks/
    useMicAnalyser.ts
    useSpeechSynth.ts
    useAgentStream.ts
  lib/
    store.ts
    agent.ts
    persona.ts
    tts.ts
    sse.ts                   # SSE 파서/직렬화 유틸
    tools/{time.ts,memory.ts}
  data/memory.json           # 메모리 (gitignore)
  docs/superpowers/...        # 스펙·플랜
  tests/...
```

## 11. 빌드 방식 (superpowers + 에이전트 팀)

사용자 요청에 따라 **superpowers 스킬 + 서브에이전트/에이전트 팀을 적극 활용**:
1. `writing-plans` 스킬로 단계별 구현 플랜 작성
2. 독립 컴포넌트(그래픽 / 음성 / 서버-에이전트 / 상태)를 **병렬 서브에이전트**로 동시 구현
3. 로직 단위는 TDD
4. 완료 후 코드리뷰 서브에이전트로 검증, Playwright 시각 확인

## 12. 범위 (YAGNI)

**v1 포함**: 단일 사용자·로컬·한국어, 음성 대화, 오브+네뷸라 비주얼(4상태),
WebSearch·time·memory 도구, 리서치 에이전트 팀, 끼어들기.

**v1 제외(추후)**: 홈서버 배포(Coolify+Cloudflare), ElevenLabs 고급 음성,
카메라/멀티모달, 인증·다중 사용자, 모바일 최적화.

## 13. 가정 / 전제 조건 (구현 전 확인 필요)

- **A1**: 머신이 Claude(Claude Code)에 로그인되어 있어 Agent SDK가 구독 인증으로
  헤드리스 작동 가능. (전제 조건)
- **A2**: Chrome 또는 Edge에서 실행(Web Speech API).
- **A3**: 끼어들기 신뢰성을 위해 헤드폰 권장.
- **A4**: Windows 11에 ko-KR TTS voice 존재(Heami 등).
- **A5**: Agent SDK의 정확한 스트리밍/서브에이전트/구독인증 API는 구현 시
  최신 문서(context7)로 버전 고정·확인.
