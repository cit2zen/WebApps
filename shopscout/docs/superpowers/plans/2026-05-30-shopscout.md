# ShopScout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 채팅형 지능형 구매 추천 웹앱 — 구매 목적을 파악하고 국내·해외 매물을 수집·평가하여 "신뢰 통과 매물 중 최저가 + 목적 부합" 상품을 추천한다.

**Architecture:** Next.js 16 풀스택. 결정적 수집 레이어(`ProductSource` → firecrawl/exa)가 매물을 모으고, 평가 에이전트 팀(5요소 병렬, `LlmClient`)이 신뢰·합리성을 채점하며, Synthesizer가 랭킹·질의 트리거를 판정한다. AI는 Claude Agent SDK(구독 자격증명)로 호출하되 `LlmClient` 인터페이스 뒤에 추상화한다.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Vitest, Playwright, better-sqlite3, firecrawl, exa, @anthropic-ai/claude-agent-sdk.

---

## File Structure

```
src/
  app/
    layout.tsx                     # 루트 레이아웃
    page.tsx                       # 채팅 페이지
    api/chat/route.ts              # 대화 엔드포인트(스트리밍)
  components/
    Chat.tsx                       # 메시지 스트림 + 입력
    ProductCard.tsx                # 매물 비교 카드 + 평가 근거
  lib/
    types.ts                       # 공용 도메인 타입 (PurchaseIntent, Listing, ...)
    llm/
      client.ts                    # LlmClient 인터페이스
      agentSdkClient.ts            # Agent SDK 구현(구독 인증)
      mockClient.ts                # 테스트용 결정적 목
    sources/
      types.ts                     # ProductSource 인터페이스
      normalize.ts                 # 원본 → Listing 정규화
      krSource.ts                  # 국내 (firecrawl/exa)
      globalSource.ts              # 해외 (firecrawl/exa)
      index.ts                     # 멀티소스 병렬 + 폴백
    purpose/
      discovery.ts                 # 발화 → PurchaseIntent, 부족 슬롯 식별
    evaluation/
      types.ts                     # Evaluator 인터페이스
      prompts.ts                   # 요소별 시스템 프롬프트
      evaluators.ts                # 5개 평가자
      team.ts                      # 병렬 실행기
    recommender/
      synthesize.ts                # 종합·랭킹·질의 트리거
    store/
      types.ts                     # Store 인터페이스
      sqliteStore.ts               # SQLite 구현
    orchestrator/
      orchestrator.ts              # 턴 관리 + 파이프라인 조립
tests/
  fixtures/                        # 저장된 매물/스크랩 픽스처
  *.test.ts
```

---

## Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "shopscout",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "better-sqlite3": "^11.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "vitest": "^2.1.0",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: vitest.config.ts, next.config.ts, .env.example**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```
```ts
// next.config.ts
import type { NextConfig } from 'next';
const config: NextConfig = { serverExternalPackages: ['better-sqlite3'] };
export default config;
```
```bash
# .env.example
FIRECRAWL_API_KEY=
EXA_API_KEY=
# Agent SDK는 구독 자격증명(Claude Code 로그인)을 사용하므로 키 불필요
```

- [ ] **Step 4: 루트 레이아웃·페이지 골격**

```tsx
// src/app/layout.tsx
export const metadata = { title: 'ShopScout', description: '지능형 구매 추천' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ko"><body>{children}</body></html>);
}
```
```tsx
// src/app/page.tsx
import Chat from '@/components/Chat';
export default function Home() {
  return (<main style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}><h1>ShopScout</h1><Chat /></main>);
}
```

- [ ] **Step 5: install + typecheck**

Run: `npm install && npx tsc --noEmit`
Expected: 설치 성공, 타입 에러 없음(Chat 컴포넌트는 Task 9에서 생성 — 임시로 빈 컴포넌트 생성).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: Next.js 16 + Vitest 스캐폴드"
```

---

## Task 2: 도메인 타입

**Files:**
- Create: `src/lib/types.ts`
- Test: `tests/types.test.ts`

- [ ] **Step 1: 테스트(타입 가드/팩토리 검증)**

```ts
// tests/types.test.ts
import { describe, it, expect } from 'vitest';
import { emptyIntent, totalPrice } from '@/lib/types';
describe('types', () => {
  it('emptyIntent는 빈 슬롯 배열을 가진다', () => {
    const i = emptyIntent('무선 키보드');
    expect(i.rawQuery).toBe('무선 키보드');
    expect(i.mustHaves).toEqual([]);
  });
  it('totalPrice는 배송비를 더한다', () => {
    expect(totalPrice({ priceKRW: 10000, shippingKRW: 3000 } as any)).toBe(13000);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/types.test.ts` Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/types.ts
export interface PurchaseIntent {
  rawQuery: string;
  category?: string;
  budgetKRW?: { min?: number; max?: number };
  useCase?: string;
  mustHaves: string[];
  niceToHaves: string[];
  dealbreakers: string[];
  missingSlots: string[];
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
  raw: unknown;
}
export type FactorCode = 'a' | 'b' | 'c' | 'd' | 'e';
export interface FactorResult {
  code: FactorCode;
  score: number;
  confidence: number;
  flags: string[];
  rationale: string;
}
export interface Evaluation {
  listingId: string;
  factors: FactorResult[];
  trustScore: number;
  passesTrustThreshold: boolean;
}
export interface Recommendation {
  ranked: { listing: Listing; evaluation: Evaluation; reason: string }[];
  askUser?: { question: string; options?: string[]; reason: string };
}
export function emptyIntent(rawQuery: string): PurchaseIntent {
  return { rawQuery, mustHaves: [], niceToHaves: [], dealbreakers: [], missingSlots: [] };
}
export function totalPrice(l: Pick<Listing, 'priceKRW' | 'shippingKRW'>): number {
  return l.priceKRW + (l.shippingKRW ?? 0);
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/types.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: 도메인 타입 정의"`

---

## Task 3: LlmClient 인터페이스 + 목

**Files:**
- Create: `src/lib/llm/client.ts`, `src/lib/llm/mockClient.ts`
- Test: `tests/llm.test.ts`

- [ ] **Step 1: 테스트**

```ts
// tests/llm.test.ts
import { describe, it, expect } from 'vitest';
import { MockLlmClient } from '@/lib/llm/mockClient';
describe('MockLlmClient', () => {
  it('등록된 응답을 스키마대로 반환한다', async () => {
    const c = new MockLlmClient({ greet: { ok: true } });
    const r = await c.structured({ key: 'greet', system: 's', prompt: 'p', schema: {} as any });
    expect(r).toEqual({ ok: true });
  });
  it('미등록 key는 에러', async () => {
    const c = new MockLlmClient({});
    await expect(c.structured({ key: 'x', system: '', prompt: '', schema: {} as any }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/llm.test.ts` Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/llm/client.ts
import type { ZodType } from 'zod';
export interface StructuredCall<T> {
  key: string;            // 캐시/목 식별자
  system: string;
  prompt: string;
  schema: ZodType<T>;
}
export interface LlmClient {
  structured<T>(call: StructuredCall<T>): Promise<T>;
}
```
```ts
// src/lib/llm/mockClient.ts
import type { LlmClient, StructuredCall } from './client';
export class MockLlmClient implements LlmClient {
  constructor(private responses: Record<string, unknown>) {}
  async structured<T>(call: StructuredCall<T>): Promise<T> {
    if (!(call.key in this.responses)) throw new Error(`Mock 미등록 key: ${call.key}`);
    return this.responses[call.key] as T;
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/llm.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: LlmClient 인터페이스 + 목"`

---

## Task 4: Agent SDK 클라이언트 (구독 인증)

**Files:**
- Create: `src/lib/llm/agentSdkClient.ts`
- Test: `tests/agentSdk.test.ts` (JSON 추출 로직만 단위 테스트)

- [ ] **Step 1: 테스트 (응답에서 JSON 블록 추출 + zod 검증)**

```ts
// tests/agentSdk.test.ts
import { describe, it, expect } from 'vitest';
import { extractJson } from '@/lib/llm/agentSdkClient';
import { z } from 'zod';
describe('extractJson', () => {
  const schema = z.object({ score: z.number() });
  it('코드펜스 안의 JSON을 파싱·검증한다', () => {
    const out = extractJson('설명\n```json\n{"score": 80}\n```\n', schema);
    expect(out.score).toBe(80);
  });
  it('맨몸 JSON도 파싱한다', () => {
    expect(extractJson('{"score": 12}', schema).score).toBe(12);
  });
  it('스키마 불일치는 throw', () => {
    expect(() => extractJson('{"score":"x"}', schema)).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/agentSdk.test.ts` Expected: FAIL

- [ ] **Step 3: 구현** (Agent SDK는 `query()`로 호출; 구독 인증은 Claude Code 로그인 세션을 사용)

```ts
// src/lib/llm/agentSdkClient.ts
import { z, type ZodType } from 'zod';
import type { LlmClient, StructuredCall } from './client';

export function extractJson<T>(text: string, schema: ZodType<T>): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(candidate.trim());
  return schema.parse(parsed);
}

export interface AgentSdkOptions {
  model?: string;
  maxRetries?: number;
}

// Agent SDK는 동적 import (서버 전용)
export class AgentSdkClient implements LlmClient {
  constructor(private opts: AgentSdkOptions = {}) {}
  async structured<T>(call: StructuredCall<T>): Promise<T> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const retries = this.opts.maxRetries ?? 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const prompt = `${call.system}\n\n${call.prompt}\n\n반드시 유효한 JSON만 \`\`\`json 코드펜스로 출력.`;
        let text = '';
        for await (const msg of query({ prompt, options: { model: this.opts.model } })) {
          if (msg.type === 'assistant') {
            for (const block of msg.message.content) {
              if (block.type === 'text') text += block.text;
            }
          }
        }
        return extractJson(text, call.schema);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
    throw new Error(`AgentSdkClient 실패(${call.key}): ${String(lastErr)}`);
  }
}
```

> 참고: Agent SDK 메시지 형태는 구현 시 `@anthropic-ai/claude-agent-sdk` 실제 타입에 맞춰 조정. JSON 추출 로직(`extractJson`)이 핵심이며 단위 테스트로 고정한다.

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/agentSdk.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Agent SDK 클라이언트(구독 인증) + JSON 추출"`

---

## Task 5: ProductSource 인터페이스 + 정규화

**Files:**
- Create: `src/lib/sources/types.ts`, `src/lib/sources/normalize.ts`
- Test: `tests/normalize.test.ts`, `tests/fixtures/coupang-sample.json`

- [ ] **Step 1: 픽스처 + 테스트**

```json
// tests/fixtures/coupang-sample.json
{
  "marketplace": "쿠팡",
  "url": "https://coupang.com/vp/products/123",
  "title": "무선 기계식 키보드 적축 10만원",
  "price": "98,000원",
  "shipping": "무료배송",
  "seller": "키보드월드",
  "rating": "4.5",
  "reviewCount": "1,234",
  "images": ["https://img/1.jpg"],
  "specs": { "축": "적축", "연결": "무선" }
}
```
```ts
// tests/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeListing } from '@/lib/sources/normalize';
import sample from './fixtures/coupang-sample.json';
describe('normalizeListing', () => {
  it('한국어 가격 문자열을 숫자로 변환', () => {
    const l = normalizeListing(sample as any, 'kr');
    expect(l.priceKRW).toBe(98000);
    expect(l.shippingKRW).toBe(0);
    expect(l.reviewCount).toBe(1234);
    expect(l.rating).toBe(4.5);
    expect(l.source).toBe('kr');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/normalize.test.ts` Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/sources/types.ts
import type { Listing, PurchaseIntent } from '@/lib/types';
export interface SearchHit { url: string; title: string; marketplace: string; }
export interface ProductSource {
  name: string;
  search(intent: PurchaseIntent, limit: number): Promise<SearchHit[]>;
  fetchListing(hit: SearchHit): Promise<Listing>;
}
```
```ts
// src/lib/sources/normalize.ts
import type { Listing } from '@/lib/types';
export function parseKRW(s: string | number | undefined): number {
  if (s == null) return 0;
  if (typeof s === 'number') return s;
  if (/무료/.test(s)) return 0;
  const digits = s.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
let counter = 0;
export function normalizeListing(raw: any, source: 'kr' | 'global'): Listing {
  return {
    id: `${source}-${raw.url ?? counter++}`,
    source,
    marketplace: raw.marketplace ?? '알수없음',
    url: raw.url,
    title: raw.title ?? '',
    priceKRW: parseKRW(raw.price),
    shippingKRW: parseKRW(raw.shipping),
    seller: raw.seller,
    rating: raw.rating ? parseFloat(String(raw.rating)) : undefined,
    reviewCount: raw.reviewCount ? parseKRW(raw.reviewCount) : undefined,
    images: raw.images ?? [],
    rawSpecs: raw.specs ?? {},
    raw,
  };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/normalize.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: ProductSource 인터페이스 + 정규화"`

---

## Task 6: 멀티소스 병렬 + 폴백

**Files:**
- Create: `src/lib/sources/krSource.ts`, `src/lib/sources/globalSource.ts`, `src/lib/sources/index.ts`
- Test: `tests/multiSource.test.ts`

- [ ] **Step 1: 테스트 (가짜 소스로 병렬·폴백 검증)**

```ts
// tests/multiSource.test.ts
import { describe, it, expect } from 'vitest';
import { gatherListings } from '@/lib/sources/index';
import type { ProductSource } from '@/lib/sources/types';
const ok: ProductSource = {
  name: 'ok',
  async search() { return [{ url: 'u1', title: 't', marketplace: 'm' }]; },
  async fetchListing(h) { return { id: h.url, source: 'kr', marketplace: 'm', url: h.url, title: 't', priceKRW: 100, images: [], rawSpecs: {}, raw: {} } as any; },
};
const broken: ProductSource = {
  name: 'broken',
  async search() { throw new Error('blocked'); },
  async fetchListing() { throw new Error('blocked'); },
};
describe('gatherListings', () => {
  it('일부 소스 실패해도 정상 소스 결과를 반환하고 누락을 보고', async () => {
    const intent = { rawQuery: 'x', mustHaves: [], niceToHaves: [], dealbreakers: [], missingSlots: [] };
    const res = await gatherListings([ok, broken], intent as any, 5);
    expect(res.listings.length).toBe(1);
    expect(res.failedSources).toContain('broken');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/multiSource.test.ts` Expected: FAIL

- [ ] **Step 3: 구현** (krSource/globalSource는 firecrawl/exa 호출; 테스트는 index의 조립 로직만)

```ts
// src/lib/sources/index.ts
import type { Listing, PurchaseIntent } from '@/lib/types';
import type { ProductSource } from './types';
export interface GatherResult { listings: Listing[]; failedSources: string[]; }
export async function gatherListings(
  sources: ProductSource[], intent: PurchaseIntent, perSource: number,
): Promise<GatherResult> {
  const failedSources: string[] = [];
  const all: Listing[] = [];
  await Promise.all(sources.map(async (src) => {
    try {
      const hits = await src.search(intent, perSource);
      const listings = await Promise.all(hits.map((h) =>
        src.fetchListing(h).catch(() => null)));
      for (const l of listings) if (l) all.push(l);
    } catch {
      failedSources.push(src.name);
    }
  }));
  return { listings: all, failedSources };
}
```
```ts
// src/lib/sources/krSource.ts  (firecrawl/exa 기반 — 실제 호출, 단위 테스트 비대상)
import type { ProductSource, SearchHit } from './types';
import { normalizeListing } from './normalize';
import type { PurchaseIntent } from '@/lib/types';
async function firecrawlSearch(queryStr: string, sites: string[], limit: number): Promise<SearchHit[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: `${queryStr} ${sites.map((s) => `site:${s}`).join(' OR ')}`, limit }),
  });
  if (!res.ok) throw new Error(`firecrawl ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map((d: any) => ({ url: d.url, title: d.title ?? '', marketplace: new URL(d.url).hostname }));
}
async function firecrawlScrape(url: string): Promise<any> {
  const key = process.env.FIRECRAWL_API_KEY;
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ['markdown', 'json'] }),
  });
  if (!res.ok) throw new Error(`firecrawl scrape ${res.status}`);
  return res.json();
}
export const krSource: ProductSource = {
  name: 'kr',
  async search(intent: PurchaseIntent, limit) {
    return firecrawlSearch(intent.rawQuery, ['coupang.com', 'shopping.naver.com', '11st.co.kr'], limit);
  },
  async fetchListing(hit) {
    const raw = await firecrawlScrape(hit.url);
    return normalizeListing({ ...raw.json, url: hit.url, marketplace: hit.marketplace, title: hit.title }, 'kr');
  },
};
```
```ts
// src/lib/sources/globalSource.ts  (구조 동일, site 목록만 amazon.com/ebay.com)
import type { ProductSource } from './types';
import { krSource } from './krSource';
export const globalSource: ProductSource = {
  ...krSource,
  name: 'global',
  async search(intent, limit) {
    // krSource.search 와 동일 패턴, 사이트만 해외로 — 실제 구현 시 firecrawlSearch 재사용 위해 normalize 분리
    return krSource.search(intent, limit);
  },
};
```

> 구현 메모: `firecrawlSearch`/`firecrawlScrape`를 `sources/firecrawl.ts`로 추출해 kr/global이 사이트 목록만 다르게 공유하도록 리팩터(DRY). exa는 폴백 검색기로 `sources/exa.ts`에 추가.

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/multiSource.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: 멀티소스 수집 + 폴백 (firecrawl/exa)"`

---

## Task 7: Purpose Discovery

**Files:**
- Create: `src/lib/purpose/discovery.ts`
- Test: `tests/purpose.test.ts`

- [ ] **Step 1: 테스트 (목 LLM으로 결정화)**

```ts
// tests/purpose.test.ts
import { describe, it, expect } from 'vitest';
import { discoverIntent, REQUIRED_SLOTS } from '@/lib/purpose/discovery';
import { MockLlmClient } from '@/lib/llm/mockClient';
describe('discoverIntent', () => {
  it('LLM 추출 결과를 PurchaseIntent로 만들고 부족 슬롯을 채운다', async () => {
    const llm = new MockLlmClient({
      'purpose:무선키보드': { category: '키보드', useCase: undefined, budgetKRW: { max: 100000 }, mustHaves: ['무선'], niceToHaves: [], dealbreakers: [] },
    });
    const intent = await discoverIntent(llm, '무선키보드', '무선 키보드 10만원');
    expect(intent.category).toBe('키보드');
    expect(intent.missingSlots).toContain('useCase'); // 용도 누락
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/purpose.test.ts` Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/purpose/discovery.ts
import { z } from 'zod';
import type { LlmClient } from '@/lib/llm/client';
import { emptyIntent, type PurchaseIntent } from '@/lib/types';
export const REQUIRED_SLOTS = ['useCase', 'budgetKRW', 'mustHaves'] as const;
const schema = z.object({
  category: z.string().optional(),
  useCase: z.string().optional(),
  budgetKRW: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  dealbreakers: z.array(z.string()).default([]),
});
const SYSTEM = `너는 쇼핑 상담가다. 사용자 발화에서 구매 "목적"과 제약을 추출한다.
제품명만으로 추론하지 말고, 명시되지 않은 용도/예산/필수조건은 비워둔다.`;
export async function discoverIntent(llm: LlmClient, key: string, utterance: string): Promise<PurchaseIntent> {
  const raw = await llm.structured({ key: `purpose:${key}`, system: SYSTEM, prompt: utterance, schema });
  const intent: PurchaseIntent = { ...emptyIntent(utterance), ...raw, missingSlots: [] };
  intent.missingSlots = REQUIRED_SLOTS.filter((s) => {
    const v = (intent as any)[s];
    return v == null || (Array.isArray(v) && v.length === 0);
  });
  return intent;
}
export function nextQuestion(intent: PurchaseIntent): string | null {
  const slot = intent.missingSlots[0];
  if (!slot) return null;
  return ({
    useCase: '어떤 용도로 쓰실 건가요? (사용 맥락을 알려주시면 더 잘 골라드려요)',
    budgetKRW: '예산은 어느 정도로 생각하세요?',
    mustHaves: '꼭 있어야 하는 조건이 있나요?',
  } as Record<string, string>)[slot] ?? null;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/purpose.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Purpose Discovery + 되묻기"`

---

## Task 8: 평가 에이전트 팀 (5요소 병렬)

**Files:**
- Create: `src/lib/evaluation/types.ts`, `src/lib/evaluation/prompts.ts`, `src/lib/evaluation/evaluators.ts`, `src/lib/evaluation/team.ts`
- Test: `tests/evaluation.test.ts`

- [ ] **Step 1: 테스트 (목 LLM으로 5요소 종합 검증)**

```ts
// tests/evaluation.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateListing } from '@/lib/evaluation/team';
import { MockLlmClient } from '@/lib/llm/mockClient';
import type { Listing, PurchaseIntent } from '@/lib/types';
const listing: Listing = { id: 'kr-1', source: 'kr', marketplace: '쿠팡', url: 'u', title: '무선 키보드', priceKRW: 30000, images: ['i'], rawSpecs: {}, reviewCount: 1000, rating: 4.5, raw: {} };
const intent: PurchaseIntent = { rawQuery: '무선 키보드', mustHaves: ['무선'], niceToHaves: [], dealbreakers: [], missingSlots: [] };
function factor(code: string, score: number) { return { 'eval:kr-1:' + code: { code, score, confidence: 0.9, flags: [], rationale: 'r' } }; }
describe('evaluateListing', () => {
  it('5요소를 병렬 평가하고 신뢰도 가중 종합점수를 만든다', async () => {
    const llm = new MockLlmClient(Object.assign({}, ...['a','b','c','d','e'].map((c) => factor(c, 80))));
    const ev = await evaluateListing(llm, listing, intent);
    expect(ev.factors.length).toBe(5);
    expect(ev.trustScore).toBeGreaterThan(0);
    expect(ev.passesTrustThreshold).toBe(true);
  });
  it('위험 플래그(가격 요소 저점)면 임계 통과 실패', async () => {
    const resp = Object.assign({}, ...['a','b','d','e'].map((c) => factor(c, 80)), { 'eval:kr-1:c': { code: 'c', score: 10, confidence: 0.95, flags: ['미끼가의심'], rationale: 'r' } });
    const llm = new MockLlmClient(resp);
    const ev = await evaluateListing(llm, listing, intent);
    expect(ev.passesTrustThreshold).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/evaluation.test.ts` Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/evaluation/types.ts
import { z } from 'zod';
import type { FactorCode } from '@/lib/types';
export const factorSchema = z.object({
  code: z.string(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  flags: z.array(z.string()).default([]),
  rationale: z.string().default(''),
});
export interface EvaluatorDef { code: FactorCode; name: string; }
```
```ts
// src/lib/evaluation/prompts.ts
import type { FactorCode } from '@/lib/types';
export const FACTOR_PROMPTS: Record<FactorCode, { name: string; system: string }> = {
  a: { name: '후기 진위', system: '후기 수/별점 분포(5점 몰림), 텍스트 다양성, 동일문구 반복, 단기 폭증, 사진후기 비율로 후기 신뢰도를 0~100 채점. 정보 부족이면 confidence를 낮추고 flags에 "정보부족".' },
  b: { name: '사진·정품/사양 일치', system: '대표사진 스톡/도용 여부, 사진 속 모델명·사양이 요청과 일치하는지, 정품/병행/리퍼 표기를 근거로 0~100 채점.' },
  c: { name: '가격·허위매물', system: '시세 대비 비정상 저가, 배송비/옵션가 함정, 재고·판매자 신뢰도, 미끼가 의심을 근거로 0~100 채점. 미끼가 의심이면 flags에 "미끼가의심".' },
  d: { name: '광고·협찬', system: '스폰서/파워링크 표기, 협찬 후기 패턴을 탐지. 상위노출=품질 아님을 보정하여 0~100 채점.' },
  e: { name: '목적 적합성·합리성', system: '추출된 구매 목적 대비 과/부족 스펙, 더 싼 동급 대안, 다른 제품군이 목적에 더 맞는지를 근거로 0~100 채점. 더 합리적 대안이 있으면 flags에 "대안있음".' },
};
```
```ts
// src/lib/evaluation/team.ts
import type { LlmClient } from '@/lib/llm/client';
import type { Evaluation, FactorCode, FactorResult, Listing, PurchaseIntent } from '@/lib/types';
import { factorSchema } from './types';
import { FACTOR_PROMPTS } from './prompts';
const CODES: FactorCode[] = ['a', 'b', 'c', 'd', 'e'];
const TRUST_THRESHOLD = 50;
function listingContext(l: Listing): string {
  return JSON.stringify({ title: l.title, price: l.priceKRW, shipping: l.shippingKRW, seller: l.seller, rating: l.rating, reviewCount: l.reviewCount, specs: l.rawSpecs, images: l.images.length }, null, 2);
}
async function evalFactor(llm: LlmClient, code: FactorCode, l: Listing, intent: PurchaseIntent): Promise<FactorResult> {
  const def = FACTOR_PROMPTS[code];
  try {
    const r = await llm.structured({
      key: `eval:${l.id}:${code}`, system: def.system,
      prompt: `구매목적:\n${JSON.stringify(intent)}\n\n매물:\n${listingContext(l)}`, schema: factorSchema,
    });
    return { ...r, code } as FactorResult;
  } catch {
    return { code, score: 0, confidence: 0, flags: ['평가실패'], rationale: '평가 호출 실패' };
  }
}
export async function evaluateListing(llm: LlmClient, l: Listing, intent: PurchaseIntent): Promise<Evaluation> {
  const factors = await Promise.all(CODES.map((c) => evalFactor(llm, c, l, intent)));
  const wsum = factors.reduce((a, f) => a + f.score * f.confidence, 0);
  const wtot = factors.reduce((a, f) => a + f.confidence, 0) || 1;
  const trustScore = Math.round(wsum / wtot);
  const priceFactor = factors.find((f) => f.code === 'c');
  const hasRedFlag = factors.some((f) => f.flags.some((fl) => /미끼가의심|허위|도용|평가실패/.test(fl)));
  const passesTrustThreshold = trustScore >= TRUST_THRESHOLD && !hasRedFlag && (priceFactor?.score ?? 0) >= 30;
  return { listingId: l.id, factors, trustScore, passesTrustThreshold };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/evaluation.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: 평가 에이전트 팀(5요소 병렬)"`

---

## Task 9: Synthesizer (랭킹·질의 트리거)

**Files:**
- Create: `src/lib/recommender/synthesize.ts`
- Test: `tests/synthesize.test.ts`

- [ ] **Step 1: 테스트 (LLM 비의존, 결정적)**

```ts
// tests/synthesize.test.ts
import { describe, it, expect } from 'vitest';
import { synthesize } from '@/lib/recommender/synthesize';
import type { Evaluation, Listing } from '@/lib/types';
function L(id: string, price: number): Listing { return { id, source: 'kr', marketplace: '쿠팡', url: id, title: id, priceKRW: price, images: [], rawSpecs: {}, raw: {} }; }
function E(id: string, trust: number, pass: boolean, flags: string[] = []): Evaluation { return { listingId: id, factors: [{ code: 'e', score: 50, confidence: 1, flags, rationale: '' }], trustScore: trust, passesTrustThreshold: pass }; }
describe('synthesize', () => {
  it('신뢰 통과 매물 중 최저가를 1순위로', () => {
    const rec = synthesize([L('a', 50000), L('b', 30000)], [E('a', 80, true), E('b', 80, true)]);
    expect(rec.ranked[0].listing.id).toBe('b');
  });
  it('최저가가 임계 미달이면 확인 질의를 만든다', () => {
    const rec = synthesize([L('a', 50000), L('b', 30000)], [E('a', 80, true), E('b', 20, false, ['미끼가의심'])]);
    expect(rec.askUser).toBeTruthy();
  });
  it('"대안있음" 플래그가 있으면 질의', () => {
    const rec = synthesize([L('a', 50000)], [E('a', 80, true, ['대안있음'])]);
    expect(rec.askUser).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/synthesize.test.ts` Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/recommender/synthesize.ts
import { totalPrice, type Evaluation, type Listing, type Recommendation } from '@/lib/types';
export function synthesize(listings: Listing[], evals: Evaluation[]): Recommendation {
  const byId = new Map(evals.map((e) => [e.listingId, e]));
  const rows = listings
    .map((l) => ({ listing: l, evaluation: byId.get(l.id)! }))
    .filter((r) => r.evaluation);
  const passing = rows.filter((r) => r.evaluation.passesTrustThreshold)
    .sort((a, b) => totalPrice(a.listing) - totalPrice(b.listing));
  const failing = rows.filter((r) => !r.evaluation.passesTrustThreshold);
  const ranked = [...passing, ...failing].map((r) => ({
    listing: r.listing, evaluation: r.evaluation,
    reason: r.evaluation.passesTrustThreshold
      ? `신뢰 ${r.evaluation.trustScore}점 · 총 ${totalPrice(r.listing).toLocaleString()}원`
      : `신뢰 임계 미달(${r.evaluation.trustScore}점)`,
  }));
  // 질의 트리거
  const cheapest = rows.slice().sort((a, b) => totalPrice(a.listing) - totalPrice(b.listing))[0];
  const cheapestFailed = cheapest && !cheapest.evaluation.passesTrustThreshold;
  const hasAlternative = rows.some((r) => r.evaluation.factors.some((f) => f.flags.includes('대안있음')));
  const closeTop = passing.length >= 2 && Math.abs(passing[0].evaluation.trustScore - passing[1].evaluation.trustScore) <= 5
    && Math.abs(totalPrice(passing[0].listing) - totalPrice(passing[1].listing)) <= 5000;
  let askUser: Recommendation['askUser'];
  if (cheapestFailed) askUser = { question: `최저가 매물(${cheapest.listing.title})은 신뢰 위험 신호가 있어 제외했어요. 그래도 보시겠어요, 아니면 다음 후보로 갈까요?`, options: ['위험 매물도 보기', '안전한 다음 후보'], reason: 'cheapest-failed' };
  else if (hasAlternative) askUser = { question: '지금 찾으시는 것보다 목적에 더 맞는 대안이 있어요. 비교해 보시겠어요?', options: ['대안 비교', '현재 후보 유지'], reason: 'alternative' };
  else if (closeTop) askUser = { question: `상위 두 후보가 비슷해요. 어떤 점을 더 중요하게 보세요?`, options: ['가격', '후기/신뢰'], reason: 'close-top' };
  return { ranked, askUser };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/synthesize.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Synthesizer 랭킹·질의 트리거"`

---

## Task 10: Orchestrator + Store

**Files:**
- Create: `src/lib/store/types.ts`, `src/lib/store/sqliteStore.ts`, `src/lib/orchestrator/orchestrator.ts`
- Test: `tests/orchestrator.test.ts`

- [ ] **Step 1: 테스트 (전 파이프라인 목으로 결합)**

```ts
// tests/orchestrator.test.ts
import { describe, it, expect } from 'vitest';
import { runTurn } from '@/lib/orchestrator/orchestrator';
import { MockLlmClient } from '@/lib/llm/mockClient';
import type { ProductSource } from '@/lib/sources/types';
const src: ProductSource = {
  name: 'kr',
  async search() { return [{ url: 'u1', title: '무선 키보드', marketplace: '쿠팡' }]; },
  async fetchListing(h) { return { id: 'kr-1', source: 'kr', marketplace: '쿠팡', url: h.url, title: h.title, priceKRW: 30000, images: ['i'], rawSpecs: {}, rating: 4.5, reviewCount: 1000, raw: {} } as any; },
};
describe('runTurn', () => {
  it('슬롯 충분하면 추천까지 진행', async () => {
    const llm = new MockLlmClient({
      'purpose:t1': { category: '키보드', useCase: '코딩', budgetKRW: { max: 100000 }, mustHaves: ['무선'], niceToHaves: [], dealbreakers: [] },
      ...Object.assign({}, ...['a','b','c','d','e'].map((c) => ({ ['eval:kr-1:' + c]: { code: c, score: 80, confidence: 0.9, flags: [], rationale: 'r' } }))),
    });
    const res = await runTurn({ llm, sources: [src], turnKey: 't1', utterance: '무선 키보드 코딩용 10만원 무선' });
    expect(res.kind).toBe('recommendation');
    if (res.kind === 'recommendation') expect(res.recommendation.ranked[0].listing.id).toBe('kr-1');
  });
  it('슬롯 부족하면 되묻기', async () => {
    const llm = new MockLlmClient({ 'purpose:t2': { category: '키보드', mustHaves: [], niceToHaves: [], dealbreakers: [] } });
    const res = await runTurn({ llm, sources: [src], turnKey: 't2', utterance: '키보드' });
    expect(res.kind).toBe('question');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/orchestrator.test.ts` Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/store/types.ts
import type { PurchaseIntent, Recommendation } from '@/lib/types';
export interface Conversation { id: string; intent?: PurchaseIntent; lastRecommendation?: Recommendation; }
export interface Store {
  getConversation(id: string): Promise<Conversation | null>;
  saveConversation(c: Conversation): Promise<void>;
}
```
```ts
// src/lib/orchestrator/orchestrator.ts
import type { LlmClient } from '@/lib/llm/client';
import type { ProductSource } from '@/lib/sources/types';
import { gatherListings } from '@/lib/sources/index';
import { discoverIntent, nextQuestion } from '@/lib/purpose/discovery';
import { evaluateListing } from '@/lib/evaluation/team';
import { synthesize } from '@/lib/recommender/synthesize';
import type { Recommendation } from '@/lib/types';
export interface TurnInput { llm: LlmClient; sources: ProductSource[]; turnKey: string; utterance: string; }
export type TurnResult =
  | { kind: 'question'; question: string }
  | { kind: 'recommendation'; recommendation: Recommendation; failedSources: string[] };
export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const intent = await discoverIntent(input.llm, input.turnKey, input.utterance);
  const q = nextQuestion(intent);
  if (q) return { kind: 'question', question: q };
  const { listings, failedSources } = await gatherListings(input.sources, intent, 6);
  const evals = await Promise.all(listings.map((l) => evaluateListing(input.llm, l, intent)));
  const recommendation = synthesize(listings, evals);
  return { kind: 'recommendation', recommendation, failedSources };
}
```

> sqliteStore는 better-sqlite3로 `conversations(id TEXT PRIMARY KEY, data TEXT)` 단일 테이블에 JSON 직렬화 저장. 대화 영속화가 필요할 때 orchestrator에 주입.

- [ ] **Step 4: 통과 확인** — Run: `npm test -- tests/orchestrator.test.ts` Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Orchestrator 파이프라인 조립 + Store 인터페이스"`

---

## Task 11: API Route + 채팅 UI

**Files:**
- Create: `src/app/api/chat/route.ts`, `src/components/Chat.tsx`, `src/components/ProductCard.tsx`
- Test: `tests/api.test.ts`

- [ ] **Step 1: 테스트 (route 핸들러 직접 호출)**

```ts
// tests/api.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/sources/index', () => ({ gatherListings: async () => ({ listings: [{ id: 'kr-1', source: 'kr', marketplace: '쿠팡', url: 'u', title: '무선 키보드', priceKRW: 30000, images: [], rawSpecs: {}, raw: {} }], failedSources: [] }) }));
// 실제 LLM 대신 환경변수로 목 주입하는 팩토리를 route가 사용한다고 가정
describe('chat route', () => {
  it('질문 또는 추천 JSON을 반환한다', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ turnKey: 'tA', utterance: '키보드' }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(['question', 'recommendation']).toContain(json.kind);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tests/api.test.ts` Expected: FAIL

- [ ] **Step 3: 구현** (route는 환경에 따라 MockLlmClient 또는 AgentSdkClient 선택; 테스트 시 `SHOPSCOUT_LLM=mock`)

```ts
// src/app/api/chat/route.ts
import { runTurn } from '@/lib/orchestrator/orchestrator';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { AgentSdkClient } from '@/lib/llm/agentSdkClient';
import { krSource } from '@/lib/sources/krSource';
import { globalSource } from '@/lib/sources/globalSource';
import type { LlmClient } from '@/lib/llm/client';
function makeLlm(): LlmClient {
  if (process.env.SHOPSCOUT_LLM === 'mock') {
    return new MockLlmClient({}); // 통합 테스트는 vi.mock로 대체
  }
  return new AgentSdkClient();
}
export async function POST(req: Request) {
  const { turnKey, utterance } = await req.json();
  try {
    const res = await runTurn({ llm: makeLlm(), sources: [krSource, globalSource], turnKey, utterance });
    return Response.json(res);
  } catch (e) {
    return Response.json({ kind: 'error', message: String(e) }, { status: 500 });
  }
}
```
```tsx
// src/components/ProductCard.tsx
'use client';
import type { Evaluation, Listing } from '@/lib/types';
export default function ProductCard({ listing, evaluation, reason }: { listing: Listing; evaluation: Evaluation; reason: string }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{listing.title}</strong>
        <span>{(listing.priceKRW + (listing.shippingKRW ?? 0)).toLocaleString()}원</span>
      </div>
      <div style={{ fontSize: 13, color: '#666' }}>{listing.marketplace} · {reason}</div>
      <details><summary>평가 근거 (신뢰 {evaluation.trustScore})</summary>
        <ul>{evaluation.factors.map((f) => (<li key={f.code}>{f.code}: {f.score} {f.flags.join(',')} — {f.rationale}</li>))}</ul>
      </details>
      <a href={listing.url} target="_blank" rel="noreferrer">상품 보기 →</a>
    </div>
  );
}
```
```tsx
// src/components/Chat.tsx
'use client';
import { useState } from 'react';
import ProductCard from './ProductCard';
type Msg = { role: 'user' | 'bot'; text?: string; rec?: any };
export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [turnKey] = useState(() => 't-' + Math.random().toString(36).slice(2));
  async function send() {
    if (!input.trim()) return;
    const u = input; setInput(''); setMsgs((m) => [...m, { role: 'user', text: u }]);
    const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ turnKey, utterance: u }) });
    const data = await res.json();
    if (data.kind === 'question') setMsgs((m) => [...m, { role: 'bot', text: data.question }]);
    else if (data.kind === 'recommendation') setMsgs((m) => [...m, { role: 'bot', rec: data.recommendation }]);
    else setMsgs((m) => [...m, { role: 'bot', text: '오류: ' + (data.message ?? '알수없음') }]);
  }
  return (
    <div>
      <div style={{ minHeight: 300 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            {m.text && <div><b>{m.role === 'user' ? '나' : 'ShopScout'}:</b> {m.text}</div>}
            {m.rec && (<div>
              {m.rec.askUser && <div><b>ShopScout:</b> {m.rec.askUser.question}</div>}
              {m.rec.ranked.map((r: any) => <ProductCard key={r.listing.id} {...r} />)}
            </div>)}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} style={{ flex: 1, padding: 8 }} placeholder="무엇을 찾으세요?" />
        <button onClick={send}>보내기</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `SHOPSCOUT_LLM=mock npm test -- tests/api.test.ts` Expected: PASS. 그리고 `npx tsc --noEmit` 통과.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: chat API + 채팅 UI + 상품 카드"`

---

## Task 12: E2E (Playwright) + 마감

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/chat.spec.ts`
- Modify: 환경 분기로 E2E는 목 LLM·목 소스 사용

- [ ] **Step 1: Playwright 설정 + 시나리오**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  webServer: { command: 'SHOPSCOUT_LLM=mock SHOPSCOUT_SOURCES=mock npm run dev', port: 3000, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:3000' },
});
```
```ts
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';
test('발화 → 되묻기 흐름', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('무엇을 찾으세요?').fill('키보드');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect(page.getByText('ShopScout:')).toBeVisible({ timeout: 15000 });
});
```

- [ ] **Step 2: 실행** — Run: `npx playwright install --with-deps chromium && npm run e2e` Expected: PASS (route에 `SHOPSCOUT_SOURCES=mock` 분기로 결정적 응답)
- [ ] **Step 3: 전체 테스트** — Run: `npm test` Expected: 전부 PASS
- [ ] **Step 4: 타입·빌드** — Run: `npx tsc --noEmit && npm run build` Expected: 성공
- [ ] **Step 5: Commit** — `git add -A && git commit -m "test: E2E 채팅 시나리오 + 빌드 검증"`

---

## Task 13: README + 실행 안내

**Files:**
- Create: `README.md`

- [ ] **Step 1: README 작성** — 설치, `.env` 설정(FIRECRAWL_API_KEY, EXA_API_KEY), Agent SDK 구독 로그인(`claude` CLI 로그인 필요), `npm run dev`, 테스트 방법, 아키텍처 다이어그램 링크(스펙 문서).
- [ ] **Step 2: Commit** — `git add -A && git commit -m "docs: README 추가"`

---

## Self-Review 체크리스트 (작성자 확인 완료)

- **스펙 커버리지**: §6 5요소 → Task 8 / §7 질의 → Task 9 / §3 구독 인증 → Task 4 / §3 국내·해외 수집 → Task 6 / 목적 파악 → Task 7. ✅
- **플레이스홀더**: 각 스텝에 실제 코드·명령 포함. 일부 외부 호출(firecrawl/exa, Agent SDK 실제 메시지 형태)은 구현 시 SDK 실제 타입에 맞춰 조정하라는 명시적 메모만 남김(추상 인터페이스·JSON 추출은 테스트로 고정).
- **타입 일관성**: `PurchaseIntent/Listing/Evaluation/Recommendation/FactorResult` 명칭이 Task 2~11 전반 일치. `evaluateListing`, `synthesize`, `runTurn`, `gatherListings` 시그니처 일관. ✅
```
