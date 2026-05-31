# Project JARVIS — 음성 대화형 AI 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자의 음성에 실시간 반응하고 화려한 WebGL 그래픽(오브+파티클 네뷸라)으로 상태를 표현하는, Claude 두뇌(Agent SDK 구독 인증) 기반 한국어 음성 대화 웹앱을 만든다.

**Architecture:** Next.js 16 단일 앱. 클라이언트는 브라우저 Web Speech(STT/TTS) + Web Audio(마이크 FFT) + react-three-fiber 그래픽. 서버는 Node 런타임 route handler가 Claude Agent SDK를 구동하고 SSE로 토큰·이벤트를 스트리밍한다. 고빈도 오디오 진폭은 React 밖 mutable 객체로 흘려 60fps를 유지하고, 이산 상태(idle/listening/thinking/speaking)는 zustand로 관리한다.

**Tech Stack:** Next.js 16.2 · React 19.2 · TypeScript 5.6 · `@anthropic-ai/claude-agent-sdk` 0.3.158 · three 0.184.0 · @react-three/fiber 9.6.1 · @react-three/drei 10.7.7 · @react-three/postprocessing 3.0.4 · zustand 5 · zod 3 · Vitest(단위) · Playwright(시각 확인)

---

## 커밋 규칙

- 모든 커밋 메시지 끝에 다음 트레일러를 붙인다 (아래 commit 단계에선 생략 표기):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- 자주 커밋한다. 각 Task 끝에 1커밋.
- 작업 디렉터리: `C:\factory\Web\Jarvis` (이미 git 초기화됨, 브랜치 작업 시 `main`에서 분기).

## 전제 조건 (구현 시작 전 확인)

- **A1**: 이 머신이 Claude Code에 로그인되어 있어 Agent SDK가 구독 인증으로 작동한다. 서버 환경변수에 `CLAUDE_CODE_OAUTH_TOKEN`을 넣는다(`claude setup-token`으로 발급). `ANTHROPIC_API_KEY`는 **설정하지 않는다**(설정 시 API 종량제로 청구됨 — route에서 방어적으로 삭제).
- **A2**: 실행/테스트 브라우저는 **Chrome 또는 Edge** (Web Speech API).
- **A3**: 끼어들기(barge-in) 신뢰성을 위해 헤드폰 권장.
- **A4**: Windows 11에 `ko-KR` TTS voice 존재(Heami 등). 없으면 `utterance.lang`로 폴백.
- **A5(해소됨)**: 본 플랜의 모든 라이브러리 버전/API는 2026-05-31 공식 문서·npm 레지스트리로 확인 완료.
- **A6(보안·배포 요건)**: `/api/chat`는 v1에서 의도적으로 무인증(로컬 단일 사용자 전용). v2 홈서버 배포로 공개되기 전 **반드시** 인증 + sessionId 소유권 바인딩 + 레이트리밋을 추가해야 한다(미적용 시 누구나 사용자 구독으로 에이전트 구동 가능). 에이전트 권한은 `canUseTool` allowlist로 4개 도구만 허용(bypass 미사용).

---

## 파일 구조 (최종)

```
C:\factory\Web\Jarvis\
  package.json                      # 의존성·스크립트 (수동 스캐폴드)
  tsconfig.json
  next.config.ts                    # serverExternalPackages, transpilePackages
  vitest.config.ts
  playwright.config.ts
  .env.local                        # CLAUDE_CODE_OAUTH_TOKEN (gitignore됨)
  .env.example
  next-env.d.ts                     # (next가 생성)
  app/
    layout.tsx
    globals.css
    page.tsx                        # 서버 컴포넌트: <JarvisCanvas/> + <VoiceController/>
    api/chat/route.ts               # SSE 스트리밍 (Node 런타임)
  lib/
    events.ts                       # AgentEvent 타입 (서버↔클라 공유)
    sse.ts                          # serializeEvent / createSseParser
    ttsChunker.ts                   # chunkText
    sentenceBuffer.ts               # 스트리밍 텍스트 → 완성 문장
    audioMath.ts                    # rmsFromTimeData / bandsFromFreqData
    bargeIn.ts                      # makeBargeInDetector
    audioBus.ts                     # mutable audio{} + STATE{} (React 밖)
    store.ts                        # zustand 앱 상태(mode 등)
    persona.ts                      # JARVIS 한국어 시스템 프롬프트
    memory.ts                       # readMemory / appendMemory (순수 fs)
    agentEvents.ts                  # createEventMapper (SDK 메시지 → AgentEvent)
    agent.ts                        # Agent SDK query 래퍼 (도구·서브에이전트)
    tts.ts                          # TextToSpeech 인터페이스 + BrowserTTS
    tools/
      time.ts                       # 시간 도구
      memory.ts                     # 메모리 도구 (memory.ts 래핑)
  hooks/
    useMicAnalyser.ts               # 마이크 FFT → audioBus
    useSpeechRecognition.ts         # webkitSpeechRecognition STT
    useAgentStream.ts               # /api/chat SSE 클라이언트
    useJarvis.ts                    # 전체 오케스트레이션 (STT↔서버↔TTS↔상태↔barge-in)
  components/
    VoiceController.tsx             # "음성 시작" 버튼 + 상태/자막 오버레이
    jarvis/
      JarvisCanvas.tsx              # 'use client' + dynamic(ssr:false) 래퍼
      JarvisScene.tsx               # <Canvas> + Bloom + Orb + Nebula
      Orb.tsx                       # 프레넬 글로우 오브
      Nebula.tsx                    # GPU 파티클
  data/memory.json                  # 런타임 메모리 (gitignore됨)
  tests/                            # Vitest 단위 테스트
    sse.test.ts
    ttsChunker.test.ts
    sentenceBuffer.test.ts
    audioMath.test.ts
    bargeIn.test.ts
    store.test.ts
    memory.test.ts
    agentEvents.test.ts
  e2e/
    visual.spec.ts                  # Playwright 상태별 스크린샷
```

---

# Phase 0 — 프로젝트 스캐폴드

### Task 0.1: package.json + 의존성 설치

**Files:**
- Create: `package.json`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "jarvis",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "zustand": "^5.0.2",
    "zod": "^4.0.0",
    "@anthropic-ai/claude-agent-sdk": "0.3.158",
    "three": "0.184.0",
    "@react-three/fiber": "9.6.1",
    "@react-three/drei": "10.7.7",
    "@react-three/postprocessing": "3.0.4"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "19.2.0",
    "@types/react-dom": "19.2.0",
    "@types/three": "^0.184.0",
    "vitest": "^2.1.5",
    "@playwright/test": "^1.49.0"
  }
}
```

- [ ] **Step 2: 설치 실행**

Run: `npm install`
Expected: `node_modules` 생성, 에러 없이 완료. (R3F 9 ↔ React 19 peer 경고가 없어야 정상. 경고 시 react 버전 19.2.x 확인.)

- [ ] **Step 3: Playwright 브라우저 설치**

Run: `npx playwright install chromium`
Expected: Chromium 다운로드 완료.

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: 의존성 및 스크립트 설정"
```

---

### Task 0.2: TypeScript / Next / 테스트 설정 파일

**Files:**
- Create: `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`

- [ ] **Step 1: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: next.config.ts** — Agent SDK 외부화 + three 트랜스파일

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Agent SDK는 서브프로세스(cli.js)를 spawn하므로 번들러가 건드리면 안 됨
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  // three의 JSM addon ESM 상호운용 이슈 예방 (무해)
  transpilePackages: ["three"],
};

export default nextConfig;
```

- [ ] **Step 3: vitest.config.ts** — 순수 로직은 node 환경

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vitest는 tsconfig paths를 자동으로 읽지 않으므로 @/ alias를 명시한다.
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: playwright.config.ts** — dev 서버 자동 기동, 가짜 마이크

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
    permissions: ["microphone"],
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 5: .env.example**

```bash
# claude setup-token 으로 발급한 구독 OAuth 토큰
CLAUDE_CODE_OAUTH_TOKEN=
# 선택: 메인 모델 (기본 sonnet=낮은 지연). 'opus'로 바꾸면 품질↑ 지연↑
JARVIS_MODEL=sonnet
# 중요: ANTHROPIC_API_KEY 는 설정하지 말 것 (구독이 아닌 API 종량제로 청구됨)
```

- [ ] **Step 6: 커밋**

```bash
git add tsconfig.json next.config.ts vitest.config.ts playwright.config.ts .env.example
git commit -m "chore: TypeScript/Next/테스트 설정"
```

---

### Task 0.3: Next 앱 셸 (layout, globals, 임시 page)

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

- [ ] **Step 1: app/globals.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; background: #02030a; overflow: hidden; color: #eaf6ff;
  font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
#__next, main { width: 100vw; height: 100vh; }
```

- [ ] **Step 2: app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS",
  description: "음성 대화형 AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: app/page.tsx (임시 — Phase 5에서 교체)**

```tsx
export default function Page() {
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p>JARVIS 부팅 중…</p>
    </main>
  );
}
```

- [ ] **Step 4: dev 서버로 부팅 확인**

Run: `npm run dev` 후 브라우저에서 `http://localhost:3000` 확인 → "JARVIS 부팅 중…" 표시. 확인 후 서버 종료.
Expected: 컴파일 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add app/
git commit -m "feat: Next 앱 셸 (layout/globals/임시 page)"
```

---

# Phase 1 — 순수 로직 (TDD)

> 이 Phase의 모든 모듈은 브라우저/SDK 의존이 없어 Vitest로 먼저 테스트한다.

### Task 1.1: 공유 이벤트 타입

**Files:**
- Create: `lib/events.ts`

- [ ] **Step 1: AgentEvent 타입 정의** (테스트 불필요한 타입 전용 파일)

```ts
// 서버 → 클라이언트로 흐르는 표준 이벤트 (SSE payload)
export type AgentEvent =
  | { type: "state"; state: "thinking" | "speaking" }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "subagent"; name: string }
  | { type: "done"; sessionId?: string }
  | { type: "error"; message: string };
```

- [ ] **Step 2: 커밋**

```bash
git add lib/events.ts
git commit -m "feat: AgentEvent 공유 타입"
```

---

### Task 1.2: SSE 직렬화/파싱

**Files:**
- Create: `lib/sse.ts`
- Test: `tests/sse.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/sse.test.ts
import { describe, it, expect } from "vitest";
import { serializeEvent, createSseParser } from "@/lib/sse";
import type { AgentEvent } from "@/lib/events";

describe("sse", () => {
  it("이벤트를 data 라인으로 직렬화한다", () => {
    const e: AgentEvent = { type: "text", delta: "안녕" };
    expect(serializeEvent(e)).toBe(`data: ${JSON.stringify(e)}\n\n`);
  });

  it("완성된 이벤트만 파싱하고 부분 청크는 버퍼링한다", () => {
    const push = createSseParser();
    const a: AgentEvent = { type: "text", delta: "가" };
    const b: AgentEvent = { type: "done", sessionId: "s1" };
    const full = serializeEvent(a) + serializeEvent(b);
    const firstHalf = full.slice(0, 10);
    const rest = full.slice(10);
    expect(push(firstHalf)).toEqual([]);          // 아직 \n\n 없음
    expect(push(rest)).toEqual([a, b]);           // 합쳐지면 둘 다
  });

  it("깨진 JSON은 조용히 무시한다", () => {
    const push = createSseParser();
    expect(push("data: {oops\n\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/sse.test.ts`
Expected: FAIL ("Cannot find module '@/lib/sse'").

- [ ] **Step 3: 구현**

```ts
// lib/sse.ts
import type { AgentEvent } from "./events";

export function serializeEvent(e: AgentEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}

// 청크가 쪼개져 들어와도 \n\n 경계로 안전하게 이벤트를 복원한다.
export function createSseParser() {
  let buffer = "";
  return function push(chunk: string): AgentEvent[] {
    buffer += chunk;
    const events: AgentEvent[] = [];
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        events.push(JSON.parse(json) as AgentEvent);
      } catch {
        /* 깨진 조각 무시 */
      }
    }
    return events;
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/sse.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/sse.ts tests/sse.test.ts
git commit -m "feat: SSE 직렬화/파싱 + 테스트"
```

---

### Task 1.3: TTS 문장 청커

**Files:**
- Create: `lib/ttsChunker.ts`
- Test: `tests/ttsChunker.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/ttsChunker.test.ts
import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/ttsChunker";

describe("chunkText", () => {
  it("짧은 텍스트는 그대로 한 덩어리", () => {
    expect(chunkText("안녕하세요.")).toEqual(["안녕하세요."]);
  });

  it("문장 종결부호로 나눈다", () => {
    const out = chunkText("안녕하세요. 무엇을 도와드릴까요?", 50);
    expect(out.length).toBe(2);
    expect(out[0]).toContain("안녕하세요");
  });

  it("maxLen보다 긴 한 문장은 하드 분할한다", () => {
    const long = "가".repeat(500);
    const out = chunkText(long, 180);
    expect(out.every((c) => c.length <= 180)).toBe(true);
    expect(out.join("")).toBe(long);
  });

  it("빈 문자열은 빈 배열", () => {
    expect(chunkText("")).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ttsChunker.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현** — Chrome ~15s/~200자 끊김 버그 회피용

```ts
// lib/ttsChunker.ts
// Chrome speechSynthesis는 긴 utterance(~15s/~200자)에서 잘린다.
// 문장 단위로 쪼개고, 그래도 긴 문장은 하드 분할한다.
export function chunkText(text: string, maxLen = 180): string[] {
  if (!text.trim()) return [];
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]?/g) ?? [text];
  const chunks: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLen) {
      for (let i = 0; i < trimmed.length; i += maxLen) {
        const part = trimmed.slice(i, i + maxLen).trim();
        if (part) chunks.push(part);
      }
    } else {
      chunks.push(trimmed);
    }
  }
  return chunks.filter(Boolean);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/ttsChunker.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/ttsChunker.ts tests/ttsChunker.test.ts
git commit -m "feat: TTS 문장 청커 + 테스트"
```

---

### Task 1.4: 스트리밍 문장 버퍼

**Files:**
- Create: `lib/sentenceBuffer.ts`
- Test: `tests/sentenceBuffer.test.ts`

토큰 델타를 모아 "완성된 문장"이 생길 때마다 TTS로 흘려보내기 위한 유틸.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/sentenceBuffer.test.ts
import { describe, it, expect } from "vitest";
import { createSentenceBuffer } from "@/lib/sentenceBuffer";

describe("createSentenceBuffer", () => {
  it("종결부호가 나오면 완성 문장을 방출한다", () => {
    const b = createSentenceBuffer();
    expect(b.feed("안녕하")).toEqual([]);
    expect(b.feed("세요. 반갑")).toEqual(["안녕하세요."]);
    expect(b.feed("습니다!")).toEqual(["반갑습니다!"]);
  });

  it("flush는 남은 텍스트를 반환하고 비운다", () => {
    const b = createSentenceBuffer();
    b.feed("끝맺지 않은 말");
    expect(b.flush()).toBe("끝맺지 않은 말");
    expect(b.flush()).toBe("");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/sentenceBuffer.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/sentenceBuffer.ts
// 스트리밍 텍스트 델타를 모아 완성 문장 단위로 방출한다.
const ENDERS = /[.!?。！？]/;

export function createSentenceBuffer() {
  let buf = "";
  return {
    feed(delta: string): string[] {
      buf += delta;
      const out: string[] = [];
      let m: RegExpExecArray | null;
      // 종결부호 위치까지 잘라 방출 (부호 포함)
      while ((m = ENDERS.exec(buf)) !== null) {
        const end = m.index + 1;
        const sentence = buf.slice(0, end).trim();
        if (sentence) out.push(sentence);
        buf = buf.slice(end);
      }
      return out;
    },
    flush(): string {
      const rest = buf.trim();
      buf = "";
      return rest;
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/sentenceBuffer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/sentenceBuffer.ts tests/sentenceBuffer.test.ts
git commit -m "feat: 스트리밍 문장 버퍼 + 테스트"
```

---

### Task 1.5: 오디오 수학 (RMS / 주파수 밴드)

**Files:**
- Create: `lib/audioMath.ts`
- Test: `tests/audioMath.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/audioMath.test.ts
import { describe, it, expect } from "vitest";
import { rmsFromTimeData, bandsFromFreqData } from "@/lib/audioMath";

describe("audioMath", () => {
  it("무음(128 중심)의 RMS는 0", () => {
    const silent = new Uint8Array(64).fill(128);
    expect(rmsFromTimeData(silent)).toBeCloseTo(0, 5);
  });

  it("최대 진폭(255/0 교차)의 RMS는 약 1", () => {
    const loud = new Uint8Array(64);
    for (let i = 0; i < loud.length; i++) loud[i] = i % 2 === 0 ? 255 : 0;
    expect(rmsFromTimeData(loud)).toBeGreaterThan(0.9);
  });

  it("주파수 밴드를 0..1로 정규화해 N개 반환", () => {
    const freq = new Uint8Array(100).fill(255);
    const bands = bandsFromFreqData(freq, 5);
    expect(bands.length).toBe(5);
    expect(bands.every((b) => b > 0.9 && b <= 1)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/audioMath.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/audioMath.ts
// getByteTimeDomainData: 0..255, 128=무음 중심
export function rmsFromTimeData(timeData: Uint8Array): number {
  if (timeData.length === 0) return 0; // 빈 버퍼 → NaN 방지
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128; // -1..1
    sum += v * v;
  }
  return Math.sqrt(sum / timeData.length); // 0..~1
}

// getByteFrequencyData: 0..255 → 밴드별 평균을 0..1로 정규화
export function bandsFromFreqData(freqData: Uint8Array, numBands = 5): number[] {
  const binsPerBand = Math.max(1, Math.floor(freqData.length / numBands));
  const bands: number[] = [];
  for (let b = 0; b < numBands; b++) {
    let s = 0;
    for (let i = 0; i < binsPerBand; i++) s += freqData[b * binsPerBand + i] ?? 0;
    bands.push(s / (binsPerBand * 255));
  }
  return bands;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/audioMath.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/audioMath.ts tests/audioMath.test.ts
git commit -m "feat: 오디오 RMS/밴드 계산 + 테스트"
```

---

### Task 1.6: 끼어들기(barge-in) 감지기

**Files:**
- Create: `lib/bargeIn.ts`
- Test: `tests/bargeIn.test.ts`

마이크 RMS가 임계치 이상으로 ~150ms 지속될 때만 끼어들기로 판정(TTS 에코 오인 방지).

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/bargeIn.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeBargeInDetector } from "@/lib/bargeIn";

describe("makeBargeInDetector", () => {
  it("TTS 재생 중 + 임계치 지속 시 콜백 1회", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({
      speakingThreshold: 0.1, sustainMs: 150, graceMsAfterTtsStart: 0, onBargeIn,
    });
    let now = 1000;
    tick(0.5, true, now);            // 시작
    tick(0.5, true, (now += 100));   // 100ms 지속
    expect(onBargeIn).not.toHaveBeenCalled();
    tick(0.5, true, (now += 100));   // 200ms 지속 → 발화
    expect(onBargeIn).toHaveBeenCalledTimes(1);
  });

  it("TTS 미재생 시엔 트리거하지 않는다", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({ speakingThreshold: 0.1, sustainMs: 50, graceMsAfterTtsStart: 0, onBargeIn });
    let now = 0;
    tick(0.9, false, (now += 100));
    tick(0.9, false, (now += 100));
    expect(onBargeIn).not.toHaveBeenCalled();
  });

  it("임계치 아래로 떨어지면 지속 타이머 리셋", () => {
    const onBargeIn = vi.fn();
    const tick = makeBargeInDetector({ speakingThreshold: 0.1, sustainMs: 150, graceMsAfterTtsStart: 0, onBargeIn });
    let now = 0;
    tick(0.5, true, (now += 100));
    tick(0.0, true, (now += 100));   // 리셋
    tick(0.5, true, (now += 100));
    expect(onBargeIn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/bargeIn.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/bargeIn.ts
export interface BargeInOptions {
  speakingThreshold?: number;   // TTS 중 마이크 RMS 임계치 (에코 때문에 높게)
  sustainMs?: number;           // 이만큼 지속돼야 끼어들기로 판정
  graceMsAfterTtsStart?: number;// TTS 시작 직후 무시 구간 (레벨 안정화)
  onBargeIn?: () => void;
}

// 매 프레임 tick(rms, isSpeaking, now) 호출.
export function makeBargeInDetector(opts: BargeInOptions = {}) {
  const speakingThreshold = opts.speakingThreshold ?? 0.12;
  const sustainMs = opts.sustainMs ?? 150;
  const graceMsAfterTtsStart = opts.graceMsAfterTtsStart ?? 250;
  const onBargeIn = opts.onBargeIn;

  let aboveSince = -1; // -1 = 미시작 센티넬 (now가 0부터 시작해도 모호하지 않게)
  let ttsStartedAt = 0;
  let lastSpeaking = false;

  return function tick(rms: number, isSpeaking: boolean, now: number): void {
    if (isSpeaking && !lastSpeaking) ttsStartedAt = now;
    lastSpeaking = isSpeaking;

    if (!isSpeaking) { aboveSince = -1; return; }
    if (now - ttsStartedAt < graceMsAfterTtsStart) { aboveSince = -1; return; }

    if (rms >= speakingThreshold) {
      if (aboveSince < 0) aboveSince = now;
      if (now - aboveSince >= sustainMs) {
        aboveSince = -1;
        onBargeIn?.();
      }
    } else {
      aboveSince = -1;
    }
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/bargeIn.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/bargeIn.ts tests/bargeIn.test.ts
git commit -m "feat: barge-in 감지기 + 테스트"
```

---

### Task 1.7: audioBus + zustand 스토어

**Files:**
- Create: `lib/audioBus.ts`, `lib/store.ts`
- Test: `tests/store.test.ts`

- [ ] **Step 1: audioBus.ts 작성** (React 밖 mutable — 테스트 대상 아님)

```ts
// lib/audioBus.ts
// 고빈도 값은 React state가 아니라 mutable 싱글톤으로 흘려 60fps 유지.
export type Mode = "idle" | "listening" | "thinking" | "speaking";
export const MODE_NUM: Record<Mode, number> = { idle: 0, listening: 1, thinking: 2, speaking: 3 };

// 셰이더가 useFrame에서 직접 읽는 값들
export const audio = {
  amplitude: 0,         // 0..1, 시각화에 쓰는 최종 진폭
  bands: [0, 0, 0, 0, 0] as number[],
  speakingEnv: 0,       // 말하기 중 단어 경계로 튀고 RAF에서 감쇠하는 엔벌로프
};
export const STATE = { current: 0 }; // Mode 숫자 미러 (useFrame 저비용 읽기용)
```

- [ ] **Step 2: store 실패 테스트 작성**

```ts
// tests/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useJarvisStore } from "@/lib/store";
import { STATE } from "@/lib/audioBus";

describe("useJarvisStore", () => {
  beforeEach(() => useJarvisStore.getState().reset());

  it("기본 모드는 idle", () => {
    expect(useJarvisStore.getState().mode).toBe("idle");
    expect(STATE.current).toBe(0);
  });

  it("setMode는 STATE.current 숫자 미러를 동기화한다", () => {
    useJarvisStore.getState().setMode("thinking");
    expect(useJarvisStore.getState().mode).toBe("thinking");
    expect(STATE.current).toBe(2);
  });

  it("자막/도구 알림을 저장한다", () => {
    useJarvisStore.getState().setTranscript("안녕");
    useJarvisStore.getState().setNotice("웹검색");
    expect(useJarvisStore.getState().transcript).toBe("안녕");
    expect(useJarvisStore.getState().notice).toBe("웹검색");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/store.test.ts`
Expected: FAIL.

- [ ] **Step 4: store.ts 구현**

```ts
// lib/store.ts
import { create } from "zustand";
import { STATE, MODE_NUM, type Mode } from "./audioBus";

interface JarvisState {
  mode: Mode;
  transcript: string; // 마지막 사용자 발화(자막)
  response: string;   // 현재 AI 응답 누적
  notice: string;     // 도구/서브에이전트 알림
  supported: boolean; // 브라우저 STT 지원 여부
  setMode: (m: Mode) => void;
  setTranscript: (t: string) => void;
  appendResponse: (t: string) => void;
  resetResponse: () => void;
  setNotice: (n: string) => void;
  setSupported: (s: boolean) => void;
  reset: () => void;
}

export const useJarvisStore = create<JarvisState>((set) => ({
  mode: "idle",
  transcript: "",
  response: "",
  notice: "",
  supported: true,
  setMode: (mode) => { STATE.current = MODE_NUM[mode]; set({ mode }); },
  setTranscript: (transcript) => set({ transcript }),
  appendResponse: (t) => set((s) => ({ response: s.response + t })),
  resetResponse: () => set({ response: "" }),
  setNotice: (notice) => set({ notice }),
  setSupported: (supported) => set({ supported }),
  reset: () => { STATE.current = 0; set({ mode: "idle", transcript: "", response: "", notice: "" }); },
}));
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋**

```bash
git add lib/audioBus.ts lib/store.ts tests/store.test.ts
git commit -m "feat: audioBus + zustand 상태 스토어 + 테스트"
```

---

# Phase 2 — 서버 두뇌 (Agent SDK)

### Task 2.1: 메모리 파일 유틸 (TDD)

**Files:**
- Create: `lib/memory.ts`
- Test: `tests/memory.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readMemory, appendMemory } from "@/lib/memory";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let path: string;
beforeEach(() => { path = join(tmpdir(), `jarvis-mem-${Date.now()}-${Math.random()}.json`); });
afterEach(async () => { await fs.rm(path, { force: true }); });

describe("memory", () => {
  it("파일 없으면 빈 배열을 읽는다", async () => {
    expect(await readMemory(path)).toEqual([]);
  });

  it("append 후 read하면 항목이 보인다", async () => {
    await appendMemory(path, "사용자는 다크모드를 선호한다");
    await appendMemory(path, "이름은 시티즌");
    expect(await readMemory(path)).toEqual([
      "사용자는 다크모드를 선호한다",
      "이름은 시티즌",
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/memory.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/memory.ts
import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export async function readMemory(path: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(path, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // 파일 없음/깨짐 → 빈 메모리
  }
}

export async function appendMemory(path: string, text: string): Promise<void> {
  const items = await readMemory(path);
  items.push(text);
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(items, null, 2), "utf8");
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/memory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/memory.ts tests/memory.test.ts
git commit -m "feat: 파일 기반 메모리 유틸 + 테스트"
```

---

### Task 2.2: JARVIS 페르소나 + 커스텀 도구

**Files:**
- Create: `lib/persona.ts`, `lib/tools/time.ts`, `lib/tools/memory.ts`

- [ ] **Step 1: lib/persona.ts**

```ts
// lib/persona.ts
export const MEMORY_PATH = "data/memory.json";

export const SYSTEM_PROMPT = `당신은 'JARVIS', 사용자의 한국어 음성 비서입니다.

말투:
- 한국어로, 짧고 명료하게 답합니다. 음성으로 들려줄 답이므로 긴 목록·마크다운·코드블록은 피합니다.
- 정중하지만 약간의 위트를 곁들입니다. 사용자를 정중히 대합니다.
- 한 번에 핵심만. 보통 1~3문장.

도구 사용:
- 최신 정보·사실 확인이 필요하면 WebSearch를 씁니다.
- 현재 시간/날짜는 mcp__app__now 도구를 씁니다.
- 사용자에 대해 기억해두면 좋은 사실(취향·이름·맥락)은 mcp__app__memory(action:"append")로 저장하고,
  대화 시작 시 필요하면 mcp__app__memory(action:"read")로 떠올립니다.

에이전트 팀:
- "조사/비교/리서치/자세히 알아봐 줘"처럼 폭넓은 조사가 필요하면, researcher 서브에이전트를 활용해
  여러 측면을 병렬로 조사한 뒤 핵심만 종합해 음성으로 전합니다.
- 팀을 가동할 땐 먼저 한 문장으로 알립니다. 예: "조사 팀을 잠깐 돌릴게요."`;
```

- [ ] **Step 2: lib/tools/time.ts**

```ts
// lib/tools/time.ts
import { tool } from "@anthropic-ai/claude-agent-sdk";

export const timeTool = tool(
  "now",
  "현재 서버의 날짜와 시간을 한국 시간 기준 문자열로 반환한다",
  {},
  async () => {
    const now = new Date();
    const text = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    return { content: [{ type: "text", text }] };
  },
  { annotations: { readOnlyHint: true } }
);
```

- [ ] **Step 3: lib/tools/memory.ts**

```ts
// lib/tools/memory.ts
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readMemory, appendMemory } from "@/lib/memory";
import { MEMORY_PATH } from "@/lib/persona";

export const memoryTool = tool(
  "memory",
  "사용자에 대한 장기 기억을 읽거나(action=read) 새 사실을 추가한다(action=append)",
  {
    action: z.enum(["read", "append"]).describe("수행할 작업"),
    text: z.string().optional().describe("append할 때 저장할 사실"),
  },
  async (args) => {
    try {
      if (args.action === "append") {
        await appendMemory(MEMORY_PATH, args.text ?? "");
        return { content: [{ type: "text", text: "기억했습니다." }] };
      }
      const items = await readMemory(MEMORY_PATH);
      return { content: [{ type: "text", text: items.length ? items.join("\n") : "(저장된 기억 없음)" }] };
    } catch (e) {
      // throw하면 query 전체가 죽으므로 isError로 루프 유지
      return { content: [{ type: "text", text: `메모리 오류: ${String(e)}` }], isError: true };
    }
  }
);
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (zod/SDK 타입 해석 확인)

- [ ] **Step 5: 커밋**

```bash
git add lib/persona.ts lib/tools/
git commit -m "feat: JARVIS 페르소나 + time/memory 커스텀 도구"
```

---

### Task 2.3: SDK 메시지 → AgentEvent 매퍼 (TDD)

**Files:**
- Create: `lib/agentEvents.ts`
- Test: `tests/agentEvents.test.ts`

순수 함수로 분리해 단위 테스트한다(실제 SDK 호출과 무관).

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/agentEvents.test.ts
import { describe, it, expect } from "vitest";
import { createEventMapper } from "@/lib/agentEvents";

describe("createEventMapper", () => {
  it("첫 메시지에서 thinking 상태를 1회 방출한다", () => {
    const map = createEventMapper();
    const out = map({ type: "system", subtype: "init", session_id: "s1" } as any);
    expect(out[0]).toEqual({ type: "state", state: "thinking" });
  });

  it("첫 text 델타 전에 speaking을 1회 방출하고 텍스트를 흘린다", () => {
    const map = createEventMapper();
    map({ type: "system", subtype: "init" } as any);
    const out = map({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "안녕" } },
    } as any);
    expect(out).toEqual([
      { type: "state", state: "speaking" },
      { type: "text", delta: "안녕" },
    ]);
    // 두 번째 델타엔 speaking 재방출 없음
    const out2 = map({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "하세요" } },
    } as any);
    expect(out2).toEqual([{ type: "text", delta: "하세요" }]);
  });

  it("tool_use는 tool 이벤트, Agent/Task는 subagent 이벤트", () => {
    const map = createEventMapper();
    map({ type: "system" } as any);
    const tool = map({ type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch" }] } } as any);
    expect(tool).toContainEqual({ type: "tool", name: "WebSearch" });
    const sub = map({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "researcher" } }] },
    } as any);
    expect(sub).toContainEqual({ type: "subagent", name: "researcher" });
  });

  it("result success는 done(sessionId), 에러는 error", () => {
    const ok = createEventMapper();
    ok({ type: "system" } as any);
    expect(ok({ type: "result", subtype: "success", session_id: "s9" } as any))
      .toContainEqual({ type: "done", sessionId: "s9" });

    const bad = createEventMapper();
    bad({ type: "system" } as any);
    expect(bad({ type: "result", subtype: "error_during_execution", errors: ["boom"] } as any))
      .toContainEqual({ type: "error", message: "boom" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/agentEvents.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// lib/agentEvents.ts
import type { AgentEvent } from "./events";

// SDKMessage는 큰 union이므로 필요한 필드만 느슨히 받는다.
type LooseMsg = any;

export function createEventMapper() {
  let started = false;
  let speaking = false;

  return function map(msg: LooseMsg): AgentEvent[] {
    const out: AgentEvent[] = [];
    if (!started) {
      started = true;
      out.push({ type: "state", state: "thinking" });
    }

    if (
      msg?.type === "stream_event" &&
      msg.event?.type === "content_block_delta" &&
      msg.event.delta?.type === "text_delta"
    ) {
      if (!speaking) {
        speaking = true;
        out.push({ type: "state", state: "speaking" });
      }
      out.push({ type: "text", delta: msg.event.delta.text ?? "" });
    } else if (msg?.type === "assistant") {
      for (const block of msg.message?.content ?? []) {
        if (block?.type === "tool_use") {
          if (block.name === "Agent" || block.name === "Task") {
            out.push({ type: "subagent", name: block.input?.subagent_type ?? "researcher" });
          } else {
            out.push({ type: "tool", name: block.name });
          }
        }
      }
    } else if (msg?.type === "result") {
      if (msg.subtype === "success") {
        out.push({ type: "done", sessionId: msg.session_id });
      } else {
        out.push({ type: "error", message: (msg.errors ?? []).join("; ") || "실행 오류" });
      }
    }
    return out;
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/agentEvents.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/agentEvents.ts tests/agentEvents.test.ts
git commit -m "feat: SDK 메시지 → AgentEvent 매퍼 + 테스트"
```

---

### Task 2.4: Agent SDK 래퍼

**Files:**
- Create: `lib/agent.ts`

- [ ] **Step 1: 구현** — query 구성(도구·서브에이전트·구독인증·권한)

```ts
// lib/agent.ts
import {
  query,
  createSdkMcpServer,
  type CanUseTool,
  type PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { timeTool } from "./tools/time";
import { memoryTool } from "./tools/memory";
import { SYSTEM_PROMPT } from "./persona";

const MODEL = process.env.JARVIS_MODEL || "sonnet"; // 'sonnet'=저지연, 'opus'=고품질

// 이 에이전트가 쓸 수 있는 도구의 유일한 출처. WebSearch + 앱 MCP 2종 + 서브에이전트만 허용.
const ALLOWED_TOOLS = new Set(["WebSearch", "mcp__app__now", "mcp__app__memory", "Agent"]);

// 비대화형 권한 게이트: 허용 목록만 통과, 그 외 결정적 거부(사람 개입·hang 없음).
// updatedInput은 입력을 '교체'하므로 반드시 원본 input을 그대로 돌려준다(빈 객체 금지).
export const canUseTool: CanUseTool = async (toolName, input): Promise<PermissionResult> =>
  ALLOWED_TOOLS.has(toolName)
    ? { behavior: "allow", updatedInput: input }
    : { behavior: "deny", message: `도구 '${toolName}'는 JARVIS에서 허용되지 않습니다.` };

const appServer = createSdkMcpServer({
  name: "app",
  version: "1.0.0",
  tools: [timeTool, memoryTool],
});

// 한 턴을 실행하고 SDK 메시지 제너레이터를 반환한다.
// sessionId가 있으면 이전 대화를 resume한다.
export function runJarvis(message: string, sessionId: string | undefined, signal: AbortSignal) {
  // 구독(OAuth) 인증을 강제: API 키가 있으면 그게 우선 청구되므로 제거.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  const abortController = new AbortController();
  signal.addEventListener("abort", () => abortController.abort());

  return query({
    prompt: message,
    options: {
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      includePartialMessages: true,          // 토큰 델타 스트리밍
      permissionMode: "default",             // bypass 비활성화 — canUseTool로 게이트
      canUseTool,                            // 허용 목록 외 도구는 결정적 거부(보안)
      abortController,
      ...(sessionId ? { resume: sessionId } : {}),
      mcpServers: { app: appServer },
      allowedTools: [...ALLOWED_TOOLS],
      maxTurns: 12,
      agents: {
        researcher: {
          description:
            "특정 주제를 한 측면에서 깊게 조사하는 리서치 전문가. 폭넓은 조사 시 여러 명을 병렬로 띄워 각자 다른 측면을 맡긴다.",
          prompt:
            "당신은 리서치 전문가입니다. 배정된 한 가지 측면을 WebSearch로 조사하고, 핵심 사실만 간결한 한국어로 요약해 반환하세요. 출처 URL을 함께 적습니다.",
          tools: ["WebSearch"],
          model: "sonnet",
        },
      },
    },
  });
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (옵션 키가 SDK 타입과 일치하는지 확인. `allowDangerouslySkipPermissions` 등 키 이름이 설치된 0.3.158 타입과 다르면 여기서 잡힌다 → 다르면 d.ts를 열어 정확한 키로 교정.)

- [ ] **Step 3: 커밋**

```bash
git add lib/agent.ts
git commit -m "feat: Agent SDK 래퍼 (도구·서브에이전트·구독인증)"
```

---

### Task 2.5: SSE 스트리밍 route handler

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: 구현**

```ts
// app/api/chat/route.ts
import { runJarvis } from "@/lib/agent";
import { createEventMapper } from "@/lib/agentEvents";
import { serializeEvent } from "@/lib/sse";

export const runtime = "nodejs";        // 서브프로세스 spawn → Edge 금지
export const dynamic = "force-dynamic"; // 스트리밍, 캐시 없음

export async function POST(req: Request) {
  const { message, sessionId } = (await req.json()) as { message: string; sessionId?: string };
  const encoder = new TextEncoder();
  const mapper = createEventMapper();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const q = runJarvis(message, sessionId, req.signal);
        for await (const msg of q) {
          for (const ev of mapper(msg)) emit(serializeEvent(ev));
        }
      } catch (e) {
        emit(serializeEvent({ type: "error", message: String(e) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: 환경변수 준비**

`.env.local` 생성(미존재 시): `CLAUDE_CODE_OAUTH_TOKEN=<claude setup-token 출력값>` 과 `JARVIS_MODEL=sonnet`.
`ANTHROPIC_API_KEY`가 셸/환경에 없는지 확인.

- [ ] **Step 3: 수동 스모크 테스트**

Run: `npm run dev` (별도 터미널), 그 다음:
```bash
curl -N -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\":\"한 문장으로 자기소개 해줘\"}"
```
Expected: `data: {"type":"state","state":"thinking"}` 로 시작해 `data: {"type":"text",...}` 델타들이 흐르고 `data: {"type":"done",...}`로 끝난다. (인증 실패 시 `error` 이벤트 → A1 토큰/환경 점검.) 확인 후 dev 서버 종료.

- [ ] **Step 4: 커밋**

```bash
git add app/api/chat/route.ts
git commit -m "feat: /api/chat SSE 스트리밍 라우트"
```

---

# Phase 3 — 클라이언트 음성 레이어

### Task 3.1: TTS 인터페이스 + 브라우저 구현

**Files:**
- Create: `lib/tts.ts`

speechSynthesis 기반. 문장 큐 + 단어경계 콜백 + cancel. (브라우저 API라 단위테스트 대신 Phase 6에서 시각/수동 확인. 청킹 로직은 Task 1.3에서 테스트 완료.)

- [ ] **Step 1: 구현**

```ts
// lib/tts.ts
import { chunkText } from "./ttsChunker";

export interface WordInfo { word: string; globalCharIndex: number; }

export interface TextToSpeech {
  init(): Promise<void>;
  enqueue(text: string): void;   // 문장을 큐에 추가(현재 재생 유지)
  cancel(): void;                // 큐 비우고 즉시 정지 (barge-in)
  readonly speaking: boolean;
  onWord?: (w: WordInfo) => void;
  onIdle?: () => void;           // 큐가 비고 재생 끝남
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => {
      speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener("voiceschanged", handler);
    let tries = 0;
    const poll = setInterval(() => {
      const v = speechSynthesis.getVoices();
      if (v.length || ++tries > 20) {
        clearInterval(poll);
        speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(v);
      }
    }, 100);
  });
}

export class BrowserTTS implements TextToSpeech {
  private voice: SpeechSynthesisVoice | null = null;
  private queue: string[] = [];
  private playing = false;
  private cancelled = false;
  private globalBase = 0;
  onWord?: (w: WordInfo) => void;
  onIdle?: () => void;

  get speaking() { return this.playing; }

  async init() {
    const voices = await loadVoices();
    this.voice =
      voices.find((v) => v.lang === "ko-KR") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("ko")) ||
      null;
  }

  enqueue(text: string) {
    this.cancelled = false;
    for (const c of chunkText(text)) this.queue.push(c);
    if (!this.playing) this.playNext();
  }

  cancel() {
    this.cancelled = true;
    this.queue = [];
    this.playing = false;
    speechSynthesis.cancel();
  }

  private playNext() {
    if (this.cancelled) return;
    const chunk = this.queue.shift();
    if (chunk === undefined) {
      this.playing = false;
      this.onIdle?.();
      return;
    }
    this.playing = true;
    const base = this.globalBase;
    const u = new SpeechSynthesisUtterance(chunk);
    if (this.voice) u.voice = this.voice;
    u.lang = "ko-KR";
    u.rate = 1.05;
    u.onboundary = (e) => {
      if (e.name !== "word") return;
      const len = (e as any).charLength || 0;
      const word = len > 0 ? chunk.substr(e.charIndex, len) : chunk.slice(e.charIndex).split(/\s/)[0];
      this.onWord?.({ word, globalCharIndex: base + e.charIndex });
    };
    u.onend = () => {
      this.globalBase += chunk.length;
      this.playNext();
    };
    u.onerror = (e) => {
      // 우리가 cancel()한 경우는 정상
      if (e.error !== "interrupted" && e.error !== "canceled") {
        this.playing = false;
      }
    };
    speechSynthesis.speak(u);
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add lib/tts.ts
git commit -m "feat: TTS 인터페이스 + 브라우저 구현(문장 큐·단어경계)"
```

---

### Task 3.2: 마이크 분석 훅

**Files:**
- Create: `hooks/useMicAnalyser.ts`

- [ ] **Step 1: 구현** — getUserMedia → AnalyserNode → RAF로 audioBus 갱신 + barge-in tick

```ts
// hooks/useMicAnalyser.ts
"use client";
import { useEffect, useRef } from "react";
import { rmsFromTimeData, bandsFromFreqData } from "@/lib/audioMath";
import { audio } from "@/lib/audioBus";

export interface MicHandle {
  rmsRef: { current: number };
  start: () => Promise<void>;
  stop: () => void;
}

// onFrame(rms, now): barge-in 감지기에 매 프레임 RMS를 전달하는 콜백.
export function useMicAnalyser(onFrame?: (rms: number, now: number) => void): MicHandle {
  const rmsRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const start = async () => {
    if (ctxRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === "suspended") await ctx.resume();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser); // destination에 연결하지 않음(피드백 방지)
    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);
      const rms = rmsFromTimeData(timeData);
      rmsRef.current = rms;
      audio.bands = bandsFromFreqData(freqData, 5);
      onFrameRef.current?.(rms, performance.now());
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close();
    ctxRef.current = null;
    streamRef.current = null;
  };

  useEffect(() => () => stop(), []);
  return { rmsRef, start, stop };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add hooks/useMicAnalyser.ts
git commit -m "feat: 마이크 FFT 분석 훅"
```

---

### Task 3.3: STT 훅

**Files:**
- Create: `hooks/useSpeechRecognition.ts`

- [ ] **Step 1: 구현** — onend 자동 재시작 가드 포함

```ts
// hooks/useSpeechRecognition.ts
"use client";
import { useCallback, useEffect, useRef } from "react";

interface Options {
  lang?: string;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onUnsupported?: () => void;
  onSpeechStart?: () => void;
}

export function useSpeechRecognition({ lang = "ko-KR", onFinal, onInterim, onUnsupported, onSpeechStart }: Options) {
  const recRef = useRef<any>(null);
  const shouldListen = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef({ onFinal, onInterim, onSpeechStart });
  cb.current = { onFinal, onInterim, onSpeechStart };

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onUnsupported?.(); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) cb.current.onFinal?.(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) cb.current.onInterim?.(interim);
    };
    rec.onspeechstart = () => cb.current.onSpeechStart?.();
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") shouldListen.current = false;
    };
    rec.onend = () => {
      if (!shouldListen.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try { rec.start(); } catch { /* InvalidStateError 등 무시 */ }
      }, 200);
    };

    recRef.current = rec;
    return () => {
      shouldListen.current = false;
      if (timer.current) clearTimeout(timer.current);
      rec.onend = null; rec.onresult = null; rec.onerror = null;
      try { rec.abort(); } catch {}
    };
  }, [lang, onUnsupported]);

  const start = useCallback(() => {
    shouldListen.current = true;
    try { recRef.current?.start(); } catch {}
  }, []);
  const stop = useCallback(() => {
    shouldListen.current = false;
    try { recRef.current?.stop(); } catch {}
  }, []);

  return { start, stop };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add hooks/useSpeechRecognition.ts
git commit -m "feat: webkitSpeechRecognition STT 훅"
```

---

### Task 3.4: SSE 클라이언트 훅

**Files:**
- Create: `hooks/useAgentStream.ts`

- [ ] **Step 1: 구현** — fetch POST + ReadableStream 리더 + 파서

```ts
// hooks/useAgentStream.ts
"use client";
import { useCallback, useRef } from "react";
import { createSseParser } from "@/lib/sse";
import type { AgentEvent } from "@/lib/events";

export function useAgentStream(onEvent: (e: AgentEvent) => void) {
  const sessionId = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const send = useCallback(async (message: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const parse = createSseParser();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: sessionId.current }),
        signal: ac.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const ev of parse(decoder.decode(value, { stream: true }))) {
          if (ev.type === "done" && ev.sessionId) sessionId.current = ev.sessionId;
          onEventRef.current(ev);
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") onEventRef.current({ type: "error", message: String(e) });
    }
  }, []);

  const abort = useCallback(() => abortRef.current?.abort(), []);
  return { send, abort };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add hooks/useAgentStream.ts
git commit -m "feat: /api/chat SSE 클라이언트 훅"
```

---

# Phase 4 — 그래픽 (react-three-fiber)

### Task 4.1: 글로우 오브

**Files:**
- Create: `components/jarvis/Orb.tsx`

- [ ] **Step 1: 구현** — 프레넬 셰이더, useFrame에서 audioBus 직접 읽기

```tsx
// components/jarvis/Orb.tsx
"use client";
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";

// 상태별 기본 색: idle 청회색 / listening 시안 / thinking 보라 / speaking 시안화이트
const STATE_COLORS = [
  new THREE.Color("#2b6f9e"),
  new THREE.Color("#22e0ff"),
  new THREE.Color("#a366ff"),
  new THREE.Color("#9af3ff"),
];

const FresnelMaterial = shaderMaterial(
  { uTime: 0, uIntensity: 1, uColor: new THREE.Color("#22e0ff") },
  /* glsl */ `
    varying vec3 vNormal; varying vec3 vViewDir;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform float uTime; uniform float uIntensity; uniform vec3 uColor;
    varying vec3 vNormal; varying vec3 vViewDir;
    void main(){
      float fres = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
      float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
      vec3 col = uColor * fres * uIntensity * pulse * 3.0; // >1 → Bloom이 집어감
      gl_FragColor = vec4(col, fres);
    }`
);
extend({ FresnelMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { fresnelMaterial: ThreeElement<typeof FresnelMaterial>; }
}

export function Orb() {
  const mesh = useRef<THREE.Mesh>(null!);
  const mat = useRef<any>(null!);
  const color = useMemo(() => new THREE.Color("#22e0ff"), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const amp = audio.amplitude;
    mat.current.uniforms.uTime.value = t;
    mat.current.uniforms.uIntensity.value = THREE.MathUtils.lerp(
      mat.current.uniforms.uIntensity.value, 1 + amp * 3, 0.15
    );
    // 상태 색 부드럽게 전이
    color.lerp(STATE_COLORS[STATE.current] ?? STATE_COLORS[0], 0.06);
    mat.current.uniforms.uColor.value.copy(color);
    // 호흡 + 진폭 스케일 (프레임 독립)
    const target = 1 + amp * 0.4 + Math.sin(t * 1.5) * 0.03;
    const s = THREE.MathUtils.lerp(mesh.current.scale.x, target, 1 - Math.pow(0.001, delta));
    mesh.current.scale.setScalar(s);
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 24]} />
      <fresnelMaterial
        ref={mat}
        transparent
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/jarvis/Orb.tsx
git commit -m "feat: 프레넬 글로우 오브"
```

---

### Task 4.2: GPU 파티클 네뷸라

**Files:**
- Create: `components/jarvis/Nebula.tsx`

- [ ] **Step 1: 구현** — 정적 속성 1회 업로드, 유니폼만 매 프레임 갱신

```tsx
// components/jarvis/Nebula.tsx
"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { extend, useFrame, type ThreeElement } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { audio, STATE } from "@/lib/audioBus";

const NebulaMaterial = shaderMaterial(
  { uTime: 0, uAmp: 0, uState: 0, uColor: new THREE.Color("#26d6ff") },
  /* glsl */ `
    uniform float uTime, uAmp, uState;
    attribute vec3 aDir; attribute float aRadius; attribute float aSeed;
    varying float vGlow;
    void main(){
      float t = uTime + aSeed * 6.2831;
      float spin = t * (0.2 + uState * 0.25);     // thinking일수록 빠르게 공전
      float c = cos(spin), s = sin(spin);
      vec3 d = vec3(aDir.x*c - aDir.z*s, aDir.y, aDir.x*s + aDir.z*c);
      float converge = mix(1.0, 0.5, step(0.5, uState) * step(uState, 1.5)); // listening 응축
      float r = aRadius * converge * (1.0 + uAmp * 0.8) + sin(t*2.0)*0.05;
      vec3 pos = d * r;
      vGlow = 0.4 + uAmp;
      vec4 mv = modelViewMatrix * vec4(pos,1.0);
      gl_PointSize = (2.0 + uAmp*6.0) * (1.0 / -mv.z) * 300.0;
      gl_Position = projectionMatrix * mv;
    }`,
  /* glsl */ `
    uniform vec3 uColor; varying float vGlow;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float dd = length(uv);
      if (dd > 0.5) discard;
      float alpha = smoothstep(0.5, 0.0, dd);
      gl_FragColor = vec4(uColor * vGlow * 2.0, alpha);
    }`
);
extend({ NebulaMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { nebulaMaterial: ThreeElement<typeof NebulaMaterial>; }
}

export function Nebula({ count = 4000 }: { count?: number }) {
  const mat = useRef<any>(null!);
  const { positions, dirs, radii, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const dirs = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      dirs.set([x, y, z], i * 3);
      radii[i] = 1.8 + Math.random() * 2.2;
      seeds[i] = Math.random();
      positions.set([x * radii[i], y * radii[i], z * radii[i]], i * 3);
    }
    return { positions, dirs, radii, seeds };
  }, [count]);

  useFrame((state) => {
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uAmp.value = THREE.MathUtils.lerp(mat.current.uniforms.uAmp.value, audio.amplitude, 0.2);
    mat.current.uniforms.uState.value = STATE.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aDir" args={[dirs, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[radii, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <nebulaMaterial ref={mat} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/jarvis/Nebula.tsx
git commit -m "feat: GPU 파티클 네뷸라"
```

---

### Task 4.3: Scene + Canvas 래퍼

**Files:**
- Create: `components/jarvis/JarvisScene.tsx`, `components/jarvis/JarvisCanvas.tsx`

- [ ] **Step 1: JarvisScene.tsx** (default export — dynamic import 대상)

```tsx
// components/jarvis/JarvisScene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Orb } from "./Orb";
import { Nebula } from "./Nebula";

export default function JarvisScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 50 }}
    >
      <color attach="background" args={["#02030a"]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} />
      <Orb />
      <Nebula count={4000} />
      <EffectComposer>
        <Bloom mipmapBlur intensity={1.2} luminanceThreshold={0.6} luminanceSmoothing={0.3} />
      </EffectComposer>
    </Canvas>
  );
}
```

- [ ] **Step 2: JarvisCanvas.tsx** (ssr:false는 client 컴포넌트 안에서만 허용)

```tsx
// components/jarvis/JarvisCanvas.tsx
"use client";
import dynamic from "next/dynamic";

const JarvisScene = dynamic(() => import("./JarvisScene"), {
  ssr: false,
  loading: () => null,
});

export function JarvisCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <JarvisScene />
    </div>
  );
}
```

- [ ] **Step 3: page.tsx 임시 연결로 렌더 확인**

`app/page.tsx`를 잠시 아래로 교체(Phase 5에서 최종본으로 다시 교체):
```tsx
import { JarvisCanvas } from "@/components/jarvis/JarvisCanvas";
export default function Page() {
  return <main><JarvisCanvas /></main>;
}
```

- [ ] **Step 4: 시각 확인**

Run: `npm run dev` → `http://localhost:3000` (Chrome). 검은 배경에 시안색 글로우 오브 + 주위를 도는 파티클이 보여야 한다. 콘솔에 WebGL/셰이더 에러 없어야 함(StrictMode 이중 마운트 경고는 무시 가능). 확인 후 종료.
Expected: 빛나는 오브 + 파티클 네뷸라가 부드럽게 애니메이션.

- [ ] **Step 5: 커밋**

```bash
git add components/jarvis/JarvisScene.tsx components/jarvis/JarvisCanvas.tsx app/page.tsx
git commit -m "feat: JarvisScene + Canvas 래퍼 (Bloom 글로우)"
```

---

# Phase 5 — 오케스트레이션 & UI 결선

### Task 5.1: 전체 오케스트레이션 훅

**Files:**
- Create: `hooks/useJarvis.ts`

STT↔서버↔TTS↔상태↔barge-in↔시각 진폭을 한곳에서 묶는다.

- [ ] **Step 1: 구현**

```tsx
// hooks/useJarvis.ts
"use client";
import { useCallback, useEffect, useRef } from "react";
import { useMicAnalyser } from "./useMicAnalyser";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAgentStream } from "./useAgentStream";
import { BrowserTTS } from "@/lib/tts";
import { makeBargeInDetector } from "@/lib/bargeIn";
import { createSentenceBuffer } from "@/lib/sentenceBuffer";
import { useJarvisStore } from "@/lib/store";
import { audio } from "@/lib/audioBus";
import type { AgentEvent } from "@/lib/events";

export function useJarvis() {
  const store = useJarvisStore;
  const ttsRef = useRef<BrowserTTS | null>(null);
  const sentence = useRef(createSentenceBuffer());
  const startedRef = useRef(false);

  // 시각 진폭 muxing: listening=마이크RMS, speaking=감쇠 엔벌로프, else 0
  const mic = useMicAnalyser((rms, now) => {
    const mode = store.getState().mode;
    if (mode === "listening") audio.amplitude = rms;
    else if (mode === "speaking") {
      audio.speakingEnv = Math.max(0, audio.speakingEnv - 0.04);
      audio.amplitude = audio.speakingEnv;
    } else {
      audio.amplitude = Math.max(0, audio.amplitude - 0.03);
    }
    bargeTick.current(rms, ttsRef.current?.speaking ?? false, now);
  });

  const bargeTick = useRef(makeBargeInDetector({}));

  const { send, abort } = useAgentStream((e: AgentEvent) => onEvent(e));

  const onEvent = useCallback((e: AgentEvent) => {
    const s = store.getState();
    switch (e.type) {
      case "state":
        s.setMode(e.state);
        break;
      case "text":
        s.appendResponse(e.delta);
        for (const sent of sentence.current.feed(e.delta)) ttsRef.current?.enqueue(sent);
        break;
      case "tool":
        s.setNotice(`도구: ${e.name}`);
        break;
      case "subagent":
        s.setNotice(`에이전트 팀: ${e.name}`);
        break;
      case "done": {
        const rest = sentence.current.flush();
        if (rest) ttsRef.current?.enqueue(rest);
        // TTS 큐가 비면 listening으로 (onIdle에서 처리)
        break;
      }
      case "error":
        s.setNotice("문제가 발생했어요.");
        s.setMode("listening");
        break;
    }
  }, [store]);

  const { start: startStt, stop: stopStt } = useSpeechRecognition({
    lang: "ko-KR",
    onUnsupported: () => store.getState().setSupported(false),
    onFinal: (text) => {
      if (!text) return;
      const s = store.getState();
      s.setTranscript(text);
      s.resetResponse();
      sentence.current = createSentenceBuffer();
      s.setMode("thinking");
      send(text);
    },
  });

  // barge-in 콜백 결선: 말하는 도중 사용자가 끼어들면 TTS·서버 중단
  useEffect(() => {
    bargeTick.current = makeBargeInDetector({
      onBargeIn: () => {
        ttsRef.current?.cancel();
        abort();
        store.getState().setMode("listening");
      },
    });
  }, [abort, store]);

  // 첫 사용자 제스처에서 호출 (오디오/마이크/TTS 시작 + 인사)
  const enable = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const s = store.getState();
    const tts = new BrowserTTS();
    await tts.init();
    tts.onWord = () => { audio.speakingEnv = 0.85; }; // 단어마다 엔벌로프 튐
    tts.onIdle = () => {
      const m = store.getState().mode;
      if (m === "speaking" || m === "thinking") store.getState().setMode("listening");
    };
    ttsRef.current = tts;
    try {
      await mic.start(); // 마이크 권한 거부/장치 없음 → reject → 아래 catch
    } catch {
      startedRef.current = false;
      s.setNotice("마이크 권한이 필요해요. 허용 후 다시 시작해주세요.");
      return;
    }
    startStt();
    s.setMode("speaking");
    tts.enqueue("안녕하세요. JARVIS입니다. 무엇을 도와드릴까요?");
  }, [mic, startStt, store]);

  useEffect(() => () => { stopStt(); ttsRef.current?.cancel(); }, [stopStt]);

  return { enable };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add hooks/useJarvis.ts
git commit -m "feat: 전체 오케스트레이션 훅 (STT↔서버↔TTS↔barge-in)"
```

---

### Task 5.2: VoiceController + 최종 page

**Files:**
- Create: `components/VoiceController.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: VoiceController.tsx**

```tsx
// components/VoiceController.tsx
"use client";
import { useJarvis } from "@/hooks/useJarvis";
import { useJarvisStore } from "@/lib/store";
import { useEffect, useState } from "react";

const LABEL: Record<string, string> = {
  idle: "대기", listening: "듣는 중", thinking: "사고 중", speaking: "답변 중",
};

export function VoiceController() {
  const { enable } = useJarvis();
  const mode = useJarvisStore((s) => s.mode);
  const transcript = useJarvisStore((s) => s.transcript);
  const response = useJarvisStore((s) => s.response);
  const notice = useJarvisStore((s) => s.notice);
  const supported = useJarvisStore((s) => s.supported);
  const [started, setStarted] = useState(false);

  // dev: Playwright가 상태를 강제로 바꿀 수 있게 노출 (Task 6.1)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as any).__jarvis = { setMode: useJarvisStore.getState().setMode };
    }
  }, []);

  if (!supported) {
    return <Overlay><p>이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Edge로 열어주세요.</p></Overlay>;
  }

  return (
    <>
      {!started && (
        <Overlay>
          <button
            onClick={() => { setStarted(true); enable(); }}
            style={{ padding: "16px 32px", fontSize: 18, borderRadius: 999, cursor: "pointer",
              background: "linear-gradient(#22e0ff,#2b8cff)", color: "#021018", border: "none",
              boxShadow: "0 0 40px rgba(57,208,255,.5)" }}
          >🎙️ 음성으로 대화 시작</button>
        </Overlay>
      )}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 28, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: 12, letterSpacing: ".15em", color: "#39d0ff", textTransform: "uppercase" }}>
          {LABEL[mode]}{notice ? ` · ${notice}` : ""}
        </div>
        {transcript && <div style={{ marginTop: 8, color: "#7d93a8", fontSize: 14 }}>나: {transcript}</div>}
        {response && <div style={{ marginTop: 4, color: "#eaf6ff", fontSize: 16, maxWidth: 720, margin: "4px auto 0" }}>{response}</div>}
      </div>
    </>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 10, textAlign: "center", padding: 24 }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: app/page.tsx 최종본**

```tsx
// app/page.tsx
import { JarvisCanvas } from "@/components/jarvis/JarvisCanvas";
import { VoiceController } from "@/components/VoiceController";

export default function Page() {
  return (
    <main>
      <JarvisCanvas />
      <VoiceController />
    </main>
  );
}
```

- [ ] **Step 3: 전체 수동 검증 (실제 음성)**

Run: `npm run dev` → Chrome에서 `http://localhost:3000`:
1. "음성으로 대화 시작" 클릭 → 마이크 권한 허용 → 인사 음성 들림(오브가 speaking 색·맥동).
2. "지금 몇 시야?" 말하기 → thinking(보라 응축) → 시간 답변 음성.
3. "삼성전자 주가 알려줘" 같은 웹검색 유도 → 하단에 "도구: WebSearch" 알림 → 답변.
4. AI가 말하는 도중 끼어들어 말하기 → 즉시 멈추고 listening 전환(barge-in).
Expected: 4가지 모두 동작. 문제 시 해당 Phase 디버깅.

- [ ] **Step 4: 커밋**

```bash
git add components/VoiceController.tsx app/page.tsx
git commit -m "feat: VoiceController UI + 최종 page 결선"
```

---

# Phase 6 — 시각 검증 & 마무리

### Task 6.1: Playwright 상태별 스크린샷

**Files:**
- Create: `e2e/visual.spec.ts`

실제 음성 없이, dev 노출 훅 `window.__jarvis.setMode`로 각 상태를 강제해 스크린샷.

- [ ] **Step 1: 테스트 작성**

```ts
// e2e/visual.spec.ts
import { test, expect } from "@playwright/test";

const MODES = ["idle", "listening", "thinking", "speaking"] as const;

test("상태별 비주얼 스크린샷", async ({ page }) => {
  await page.goto("/");
  // Canvas가 한 프레임 이상 렌더되도록 대기
  await page.waitForTimeout(1500);
  for (const mode of MODES) {
    await page.evaluate((m) => (window as any).__jarvis?.setMode(m), mode);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `e2e/__screens__/${mode}.png` });
  }
  // 캔버스 존재 확인
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);
});
```

- [ ] **Step 2: 실행**

Run: `npm run e2e`
Expected: PASS. `e2e/__screens__/`에 idle/listening/thinking/speaking 4장 생성. 각 이미지를 열어 색/형태가 상태별로 다른지 육안 확인(idle 청회색, listening 시안, thinking 보라, speaking 시안화이트).

- [ ] **Step 3: 스크린샷 gitignore + 커밋**

`.gitignore`에 한 줄 추가: `e2e/__screens__/`
```bash
git add e2e/visual.spec.ts .gitignore
git commit -m "test: Playwright 상태별 비주얼 스냅샷"
```

---

### Task 6.2: 전체 테스트 통과 + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: 전체 단위 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS (sse, ttsChunker, sentenceBuffer, audioMath, bargeIn, store, memory, agentEvents).

- [ ] **Step 2: 타입체크 + 프로덕션 빌드**

Run: `npx tsc --noEmit` 그리고 `npm run build`
Expected: 둘 다 에러 없이 완료. (`serverExternalPackages` 덕에 Agent SDK 번들 이슈 없어야 함. 빌드시 문제면 next.config 확인.)

- [ ] **Step 3: README.md**

```markdown
# JARVIS — 음성 대화형 AI

Claude 두뇌(Agent SDK 구독 인증) + 브라우저 음성(STT/TTS) + react-three-fiber 그래픽.
사용자의 한국어 음성에 실시간 반응하는 오브+파티클 네뷸라.

## 요구사항
- Node 18+ / Chrome 또는 Edge
- Claude Code 로그인 + 구독(Pro/Max). `claude setup-token`으로 OAuth 토큰 발급.

## 설정
1. `npm install`
2. `.env.local` 작성:
   ```
   CLAUDE_CODE_OAUTH_TOKEN=<발급 토큰>
   JARVIS_MODEL=sonnet
   ```
   ⚠️ `ANTHROPIC_API_KEY`는 넣지 마세요(구독이 아닌 API 종량제로 청구됨).
3. `npm run dev` → http://localhost:3000 (Chrome/Edge)
4. "음성으로 대화 시작" 클릭 → 마이크 허용.

## 기능
- 음성 대화(한국어), 웹검색·시간·메모리 도구, 리서치 에이전트 팀, 끼어들기(barge-in).
- 상태 비주얼: 대기/듣는 중/사고 중/답변 중.

## 테스트
- `npm test` (단위) · `npm run e2e` (시각 스냅샷)

## 향후 (v2)
- 홈서버 배포(Coolify+Cloudflare), ElevenLabs 고급 음성(진짜 파형 반응), 카메라/멀티모달.
```

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs: README"
```

---

## 완료 기준 (Definition of Done)

- [ ] `npm test` 전부 통과 (8개 테스트 파일)
- [ ] `npx tsc --noEmit` + `npm run build` 무에러
- [ ] dev에서 실제 음성 왕복 동작: 인사 → 질문 → 음성 답변
- [ ] 웹검색 도구 호출이 하단 알림에 표시됨
- [ ] 리서치성 질문에서 에이전트 팀(서브에이전트) 알림 표시됨
- [ ] barge-in: 답변 중 끼어들면 즉시 멈추고 듣기 전환
- [ ] 4가지 상태가 시각적으로 구분됨 (Playwright 스냅샷)
- [ ] 미지원 브라우저/마이크 거부 시 안내 표시

---

## Self-Review 메모 (작성자 점검 완료)

- **스펙 커버리지**: 아키텍처(Phase 0,4,5)·컴포넌트 전부(파일구조 일치)·데이터흐름(2.5,3.4,5.1)·도구+에이전트팀(2.2,2.4)·페르소나(2.2)·에러처리(3.3 미지원/권한, 5.1 barge-in/error, 1.6 게이트, 1.3 TTS 끊김)·테스트(Phase1·6)·범위·전제조건 모두 태스크로 매핑됨.
- **Placeholder 없음**: 모든 코드/테스트/명령 실체 포함.
- **타입 일관성**: `AgentEvent`(events.ts) 단일 정의를 sse/agentEvents/useAgentStream/useJarvis가 공유. `Mode`/`MODE_NUM`/`STATE`(audioBus.ts)를 store/Orb/Nebula가 공유. `TextToSpeech` 인터페이스를 BrowserTTS가 구현, useJarvis가 사용. 메서드명(`enqueue/cancel/onWord/onIdle`, `setMode/appendResponse` 등) 전 태스크 일치.
- **알려진 미세 리스크**: Agent SDK 0.3.158의 정확한 옵션 키(`allowDangerouslySkipPermissions` 등)는 Task 2.4 `tsc` 단계에서 검증/교정. R3F 커스텀 머티리얼 TS 증강은 `@types/three` 마이너 차이 시 조정(Orb/Nebula 주석 참조).
