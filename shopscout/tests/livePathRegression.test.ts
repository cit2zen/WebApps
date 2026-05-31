/**
 * 실 LLM 라이브 경로 회귀 테스트 — maxTurns 버그로 가려졌던 36건 감사 수정의 회귀 방지.
 * 기존 테스트가 전부 "스키마-완벽한" mock 출력을 써서 못 잡던 결함들을, 실 LLM이 흔히
 * 내는 부분/일탈 출력을 mock으로 재현해 검증한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { discoverIntent, mergeIntent } from '@/lib/purpose/discovery';
import { prioritizeRubric, clearPriorityCache, hashIntent } from '@/lib/taxonomy/prioritize';
import { evaluateListing } from '@/lib/evaluation/team';
import { aggregateTrust } from '@/lib/evaluation/score';
import { aggregateCategory } from '@/lib/evaluation/category';
import { synthesize } from '@/lib/recommender/synthesize';
import { pickPriceFromMarkdown } from '@/lib/sources/firecrawl';
import { parseRating, parseDeliveryDays } from '@/lib/sources/normalize';
import { generateRubric, clearRubricCache } from '@/lib/taxonomy/dynamic';
import { MockLlmClient } from '@/lib/llm/mockClient';
import type { StructuredCall } from '@/lib/llm/client';
import { emptyIntent, type Evaluation, type FactorResult, type Listing, type PurchaseIntent } from '@/lib/types';
import type { ResolvedRubric } from '@/lib/taxonomy/types';

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'kr-1',
  source: 'kr',
  marketplace: '쿠팡',
  url: 'https://x/1',
  title: '테스트 상품',
  priceKRW: 30000,
  images: [],
  rawSpecs: {},
  raw: {},
  ...over,
});

// ── bug1: discovery askedSlot 컨텍스트 배선 ──────────────────────────────
describe('bug1 discoverIntent askedSlot', () => {
  it('askedSlot이 있으면 프롬프트에 슬롯 해석 지시를 넣어 호출한다', async () => {
    let seenPrompt = '';
    const llm = new MockLlmClient({
      'purpose:k': (call: StructuredCall<unknown>) => {
        seenPrompt = call.prompt;
        return { useCase: '장시간 코딩', mustHaves: [], niceToHaves: [], dealbreakers: [] };
      },
    });
    const intent = await discoverIntent(llm, 'k', '장시간 코딩용', {
      askedSlot: 'useCase',
      prev: { ...emptyIntent('기계식 키보드') },
    });
    expect(seenPrompt).toContain('용도'); // 슬롯 라벨
    expect(seenPrompt).toContain('기계식 키보드'); // 직전 제품 맥락
    expect(intent.useCase).toBe('장시간 코딩');
    expect(intent.missingSlots).not.toContain('useCase');
  });
});

// ── bug1(budget): 부분 예산 병합 ────────────────────────────────────────
describe('bug1 mergeIntent budget partial merge', () => {
  it('새 발화가 max만 줘도 기존 min을 보존한다', () => {
    const prev: PurchaseIntent = { ...emptyIntent('노트북'), budgetKRW: { min: 500000 } };
    const next: PurchaseIntent = { ...emptyIntent('상관없음'), budgetKRW: { max: 1000000 } };
    const merged = mergeIntent(prev, next);
    expect(merged.budgetKRW).toEqual({ min: 500000, max: 1000000 });
  });
});

// ── bug3: prioritize 스케일 혼합 역전 방지 ──────────────────────────────
describe('bug3 prioritize scale-mix', () => {
  beforeEach(() => clearPriorityCache());
  it('정수 base weight 루브릭에서 LLM이 일부 key만 줘도 우선 기준이 최저가 되지 않는다', async () => {
    // health 스타일: base weight가 정수(5,4,2)인 루브릭
    const rubric: ResolvedRubric = {
      nodeId: 'health_bp',
      nodeName: '혈압계',
      criteria: [
        { key: 'clinical', label: '임상검증', check: 'c', dataNeeded: [], weight: 5, redFlags: [] },
        { key: 'cuff', label: '커프핏', check: 'c', dataNeeded: [], weight: 4, redFlags: [] },
        { key: 'cert', label: '인증', check: 'c', dataNeeded: [], weight: 5, redFlags: [] },
        { key: 'price', label: '가격', check: 'c', dataNeeded: [], weight: 2, redFlags: [] },
      ],
      scrapeHints: [],
      dynamic: false,
    };
    const intent = { ...emptyIntent('혈압계'), useCase: '집에서 정확 측정' };
    const critKey = rubric.criteria.map((c) => c.key).sort().join(',');
    const llm = new MockLlmClient({
      [`prioritize:${rubric.nodeId}::${rubric.nodeName}::${critKey}::${hashIntent(intent)}`]: {
        // 사용자가 우선한 두 기준만 반환(나머지는 누락)
        weights: [
          { key: 'clinical', importance: 0.9 },
          { key: 'cuff', importance: 0.8 },
        ],
        note: '정확도 우선',
      },
    });
    const r = await prioritizeRubric(llm, rubric, intent);
    const w = (k: string) => r.rubric.criteria.find((c) => c.key === k)!.weight;
    // 사용자가 우선한 기준이 누락된 기준보다 높아야 한다(역전 없음)
    expect(w('clinical')).toBeGreaterThan(w('cert'));
    expect(w('cuff')).toBeGreaterThan(w('price'));
  });

  it('LLM이 모든 importance를 0으로 주면 평탄화하지 않고 원본 유지', async () => {
    const rubric: ResolvedRubric = {
      nodeId: 'n',
      nodeName: 'N',
      criteria: [
        { key: 'a', label: 'A', check: 'c', dataNeeded: [], weight: 0.5, redFlags: [] },
        { key: 'b', label: 'B', check: 'c', dataNeeded: [], weight: 0.5, redFlags: [] },
      ],
      scrapeHints: [],
      dynamic: false,
    };
    const intent = emptyIntent('x');
    const critKey = 'a,b';
    const llm = new MockLlmClient({
      [`prioritize:${rubric.nodeId}::${rubric.nodeName}::${critKey}::${hashIntent(intent)}`]: {
        weights: [
          { key: 'a', importance: 0 },
          { key: 'b', importance: 0 },
        ],
        note: '',
      },
    });
    const r = await prioritizeRubric(llm, rubric, intent);
    expect(r.rubric.criteria.find((c) => c.key === 'a')!.weight).toBe(0.5); // 원본 유지
  });
});

// ── bug4: 병합 평가 per-factor 격리 ─────────────────────────────────────
describe('bug4 evaluateListing per-factor decouple', () => {
  const intent = emptyIntent('무선 키보드');
  it('한 요소(d) 누락돼도 나머지는 살고 매물이 통째로 죽지 않는다', async () => {
    const merged = {
      'eval:kr-1': {
        a: { score: 80, confidence: 0.9 },
        b: { score: 80, confidence: 0.9 },
        c: { score: 80, confidence: 0.9 },
        // d 누락
        e: { score: 80, confidence: 0.9, mustHaveMet: true },
      },
    };
    const ev = await evaluateListing(new MockLlmClient(merged), listing({ title: '무선 키보드' }), intent);
    const d = ev.factors.find((f) => f.code === 'd')!;
    expect(d.infraFailure).toBe(true); // d만 격리
    expect(ev.factors.filter((f) => f.infraFailure).length).toBe(1);
    expect(ev.passesTrustThreshold).toBe(true); // 나머지 정상이라 통과
  });

  it('confidence를 퍼센트(85)로 줘도 0.85로 정규화하고 score 문자열도 강제변환', async () => {
    const merged = {
      'eval:kr-1': {
        a: { score: '80', confidence: 85 },
        b: { score: 80, confidence: 0.9 },
        c: { score: 80, confidence: 0.9 },
        d: { score: 80, confidence: 0.9 },
        e: { score: 80, confidence: 0.9, mustHaveMet: true },
      },
    };
    const ev = await evaluateListing(new MockLlmClient(merged), listing({ title: '무선 키보드' }), intent);
    const a = ev.factors.find((f) => f.code === 'a')!;
    expect(a.score).toBe(80);
    expect(a.confidence).toBeCloseTo(0.85, 2);
    expect(a.infraFailure).toBeUndefined();
  });
});

// ── bug14: 필수조건 게이트(undefined를 자동 통과로 보지 않음) ────────────
describe('bug14 mustHave gate', () => {
  const facs = (over: Partial<FactorResult> = {}): FactorResult[] => [
    { code: 'a', score: 80, confidence: 0.9, flags: [], rationale: '' },
    { code: 'c', score: 80, confidence: 0.9, flags: [], rationale: '' },
    { code: 'e', score: 80, confidence: 0.9, flags: [], rationale: '', ...over },
  ];
  it('mustHaves 있고 리터럴 미확인 + ⓔ mustHaveMet 미명시면 통과 안 됨', () => {
    const { passesTrustThreshold } = aggregateTrust(facs(), [], ['방수'], true);
    expect(passesTrustThreshold).toBe(false);
  });
  it('리터럴로 전부 충족(unmet 없음)이면 통과', () => {
    const { passesTrustThreshold } = aggregateTrust(facs(), [], [], true);
    expect(passesTrustThreshold).toBe(true);
  });
  it('ⓔ mustHaveMet=true면 통과', () => {
    const { passesTrustThreshold } = aggregateTrust(facs({ mustHaveMet: true }), [], ['방수'], true);
    expect(passesTrustThreshold).toBe(true);
  });
  it('mustHaves가 없으면 게이트 비활성(거짓 차단 없음)', () => {
    const { passesTrustThreshold } = aggregateTrust(facs(), [], [], false);
    expect(passesTrustThreshold).toBe(true);
  });
});

// ── bug30: 전 요소 데이터부족이 '신뢰 0(나쁨)'으로 오해석되지 않음 ───────
describe('bug30 all-insufficient not zero', () => {
  it('모든 요소 confidence≈0(데이터부족)이면 trustScore가 0이 아니라 근거부족 점수', () => {
    const factors: FactorResult[] = [
      { code: 'a', score: 70, confidence: 0, flags: [], rationale: '', dataInsufficient: true },
      { code: 'c', score: 70, confidence: 0, flags: [], rationale: '', dataInsufficient: true },
    ];
    const { trustScore } = aggregateTrust(factors, []);
    expect(trustScore).toBeGreaterThan(0); // 0(나쁨) 아님
    expect(trustScore).toBeLessThan(50); // 그러나 게이트는 통과 못 함
  });
  it('전 요소 인프라 실패면 trustScore 0', () => {
    const factors: FactorResult[] = [
      { code: 'a', score: 0, confidence: 0, flags: [], rationale: '', infraFailure: true },
    ];
    expect(aggregateTrust(factors, []).trustScore).toBe(0);
  });
});

// ── bug5: 카테고리 위험 게이트가 redFlag 매칭에 의존 ─────────────────────
describe('bug5 category risk gate redFlag match', () => {
  const rubric: ResolvedRubric = {
    nodeId: 'n',
    nodeName: 'N',
    criteria: [{ key: 'safety', label: '안전', check: 'c', dataNeeded: [], weight: 1, redFlags: ['리콜이력'] }],
    scrapeHints: [],
    dynamic: false,
  };
  it('통제 어휘(redFlag) 매칭 + 저점수면 카테고리위험', () => {
    const f = aggregateCategory(rubric, [{ key: 'safety', score: 20, confidence: 0.8, flags: ['리콜이력'] }], '');
    expect(f.flags).toContain('카테고리위험');
  });
  it('무해 단어 flag(저점수여도)는 위험으로 보지 않는다', () => {
    const f = aggregateCategory(rubric, [{ key: 'safety', score: 20, confidence: 0.8, flags: ['배송조금느림'] }], '');
    expect(f.flags).not.toContain('카테고리위험');
  });
});

// ── bug6: 인프라 전량 실패 → degraded(오해 메시지 차단) ──────────────────
describe('bug6 synthesize infra-wide degraded', () => {
  it('모든 매물 표준요소 인프라 실패면 degraded=true, askUser 없음, 시스템오류 메시지', () => {
    const infra = (id: string): { l: Listing; e: Evaluation } => ({
      l: listing({ id, url: `https://x/${id}` }),
      e: {
        listingId: id,
        factors: ['a', 'b', 'c', 'd', 'e'].map((c) => ({
          code: c as any, score: 0, confidence: 0, flags: ['평가불가'], rationale: '', infraFailure: true,
        })),
        trustScore: 0,
        passesTrustThreshold: false,
      },
    });
    const items = [infra('a'), infra('b')];
    const rec = synthesize(items.map((i) => i.l), items.map((i) => i.e), { ...emptyIntent('키보드'), budgetKRW: { max: 100000 } });
    expect(rec.degraded).toBe(true);
    expect(rec.askUser).toBeUndefined();
    expect(rec.summary).toMatch(/평가 시스템|오류/);
  });
});

// ── bug7: markdown 가격 폴백 컨텍스트 인지 ──────────────────────────────
describe('bug7 markdown price fallback', () => {
  it('배송비/정가를 거르고 반복되는 판매가를 고른다', () => {
    const md = '정가 89,000원 할인가 59,000원 배송비 3,000원 적립 500원\n구매 59,000원 결제금액 59,000원';
    expect(pickPriceFromMarkdown(md)).toBe('59,000');
  });
  it('숫자 원 표기가 없으면 undefined', () => {
    expect(pickPriceFromMarkdown('가격 문의')).toBeUndefined();
  });
});

// ── bug20/21: rating·delivery 파서 견고화 ───────────────────────────────
describe('bug20/21 parsers', () => {
  it('parseRating: 라벨/콤마소수/슬래시/별글리프', () => {
    expect(parseRating('별점 4.8')).toBeCloseTo(4.8, 2);
    expect(parseRating('4,8')).toBeCloseTo(4.8, 2);
    expect(parseRating('4.8 / 5')).toBeCloseTo(4.8, 2);
    expect(parseRating('★★★★☆')).toBeUndefined();
  });
  it('parseDeliveryDays: 무관 숫자를 소요일로 오인하지 않는다', () => {
    expect(parseDeliveryDays('2024년 출시')).toBeUndefined();
    expect(parseDeliveryDays('재고 30개')).toBeUndefined();
    expect(parseDeliveryDays('3,000원 배송')).toBeUndefined();
    expect(parseDeliveryDays('3-5일')).toBe(5);
    expect(parseDeliveryDays('2일')).toBe(2);
  });
});

// ── bug18: 배송 기한 미상 매물 가시화 + 후순위 ──────────────────────────
describe('bug18 unknown delivery under deadline', () => {
  it('소요일 미상 매물은 기한 통과시키되 cons에 미상 표기 + 동급 시 후순위', () => {
    const known: { l: Listing; e: Evaluation } = {
      l: listing({ id: 'known', url: 'https://x/known', priceKRW: 30000, deliveryDays: 2 }),
      e: { listingId: 'known', factors: [{ code: 'a', score: 80, confidence: 0.9, flags: [], rationale: '' }], trustScore: 80, passesTrustThreshold: true },
    };
    const unknown: { l: Listing; e: Evaluation } = {
      l: listing({ id: 'unknown', url: 'https://x/unknown', priceKRW: 30000 }),
      e: { listingId: 'unknown', factors: [{ code: 'a', score: 80, confidence: 0.9, flags: [], rationale: '' }], trustScore: 80, passesTrustThreshold: true },
    };
    const rec = synthesize([unknown.l, known.l], [unknown.e, known.e], { ...emptyIntent('x'), maxDeliveryDays: 3 });
    // 동급 가격·신뢰면 소요일 아는 매물이 앞
    expect(rec.ranked[0].listing.id).toBe('known');
    const unknownItem = rec.ranked.find((r) => r.listing.id === 'unknown')!;
    expect((unknownItem.cons ?? []).some((c) => c.includes('배송기간 미상'))).toBe(true);
  });
});

// ════════ 자체감사(2차) 회귀 ════════

// ── A1: ⓔ 누락(infraFailure) 시 per-factor 격리 유지(하드 차단 아님) ────
describe('audit A1: mustHave gate respects e infraFailure', () => {
  const intent = { ...emptyIntent('무선 키보드'), mustHaves: ['무선'] };
  it('ⓔ가 누락돼 infraFailure여도 리터럴 충족(제목에 무선)이면 통과', async () => {
    // d,e 누락 → 각각 infraFailFactor. 제목 "무선 키보드"라 리터럴 매칭 충족.
    const merged = {
      'eval:kr-1': {
        a: { score: 80, confidence: 0.9 },
        b: { score: 80, confidence: 0.9 },
        c: { score: 80, confidence: 0.9 },
      },
    };
    const ev = await evaluateListing(new MockLlmClient(merged), listing({ title: '무선 키보드' }), intent);
    const e = ev.factors.find((f) => f.code === 'e')!;
    expect(e.infraFailure).toBe(true);
    expect(ev.passesTrustThreshold).toBe(true); // 격리 유지 — 매물이 통째로 죽지 않음
  });
  it('평가 가능한 ⓔ가 mustHaveMet=false면 여전히 차단', () => {
    const factors: FactorResult[] = [
      { code: 'c', score: 80, confidence: 0.9, flags: [], rationale: '' },
      { code: 'e', score: 80, confidence: 0.9, flags: [], rationale: '', mustHaveMet: false },
    ];
    expect(aggregateTrust(factors, [], [], true).passesTrustThreshold).toBe(false);
  });
});

// ── A2: 예산 0 오추출이 기존 예산을 덮지 않음 + synthesize 가드 ──────────
describe('audit A2: budget zero never overwrites / gates', () => {
  it('mergeBudget: next.max=0(오추출)은 기존 max를 덮지 않는다', () => {
    const prev: PurchaseIntent = { ...emptyIntent('노트북'), budgetKRW: { min: 50000, max: 100000 } };
    const next: PurchaseIntent = { ...emptyIntent('x'), budgetKRW: { max: 0 } };
    expect(mergeIntent(prev, next).budgetKRW).toEqual({ min: 50000, max: 100000 });
  });
  it('synthesize: budgetKRW.max=0이면 상한 없음으로 보고 매물을 버리지 않는다', () => {
    const l = listing({ id: 'a', url: 'https://x/a', priceKRW: 30000 });
    const e: Evaluation = { listingId: 'a', factors: [{ code: 'a', score: 80, confidence: 0.9, flags: [], rationale: '' }], trustScore: 80, passesTrustThreshold: true };
    const rec = synthesize([l], [e], { ...emptyIntent('x'), budgetKRW: { max: 0 } });
    expect(rec.ranked[0].reason).not.toMatch(/예산 초과/);
  });
});

// ── A3: 빈/짧은 flag 토큰이 카테고리위험 오발화하지 않음 ─────────────────
describe('audit A3: category redFlag match guards empty/short tokens', () => {
  const rubric: ResolvedRubric = {
    nodeId: 'n', nodeName: 'N',
    criteria: [{ key: 'safety', label: '안전', check: 'c', dataNeeded: [], weight: 1, redFlags: ['리콜이력'] }],
    scrapeHints: [], dynamic: false,
  };
  it('빈 문자열 flag + 저점수는 위험 아님(rf.includes("") 오매칭 차단)', () => {
    const f = aggregateCategory(rubric, [{ key: 'safety', score: 20, confidence: 0.8, flags: [''] }], '');
    expect(f.flags).not.toContain('카테고리위험');
  });
  it('통제어휘 포함 문구는 점수 무관하게 위험으로 격상', () => {
    const f = aggregateCategory(rubric, [{ key: 'safety', score: 90, confidence: 0.8, flags: ['리콜이력 있음'] }], '');
    expect(f.flags).toContain('카테고리위험');
  });
});

// ── A6: 표준요소 없는 평가는 degraded로 오분류되지 않음 ─────────────────
describe('audit A6: allInfraFailed not vacuous-true', () => {
  it('factors가 ⓕ만 있거나 비면 degraded가 아니다', () => {
    const l = listing({ id: 'a', url: 'https://x/a' });
    const fOnly: Evaluation = {
      listingId: 'a',
      factors: [{ code: 'f', score: 70, confidence: 0.8, flags: [], rationale: '' }],
      trustScore: 70, passesTrustThreshold: true,
    };
    const rec = synthesize([l], [fOnly], emptyIntent('x'));
    expect(rec.degraded).toBeFalsy();
    expect(rec.summary).not.toMatch(/평가 시스템/);
  });
});

// ── A9: parseRating 라벨/만점/후기수 선행 숫자 오인 방지 ─────────────────
describe('audit A9: parseRating ignores review-count / denominator', () => {
  it('"리뷰 1234개 평점 4.8" → 4.8 (1234를 클램프해 5.0으로 만들지 않음)', () => {
    expect(parseRating('리뷰 1234개 평점 4.8')).toBeCloseTo(4.8, 2);
  });
  it('"5점 만점에 4.5" → 4.5 (분모 5가 아님)', () => {
    expect(parseRating('5점 만점에 4.5')).toBeCloseTo(4.5, 2);
  });
  it('기존 정상 케이스 유지', () => {
    expect(parseRating('별점 4.8')).toBeCloseTo(4.8, 2);
    expect(parseRating('4,8')).toBeCloseTo(4.8, 2);
    expect(parseRating('★★★★☆')).toBeUndefined();
  });
});

// ── A10: 가격 폴백 접미 키워드 제외 + 첫 판매가 우선 ─────────────────────
describe('audit A10: price fallback excludes suffix keywords / prefers first', () => {
  it('"3,000원 배송비"(접미 명사) 거르고 상단 판매가 채택, 단 "빠른배송"은 오제외 안 함', () => {
    const md = '특가 59,000원 빠른배송\n3,000원 배송비 별도 · 500원 적립';
    expect(pickPriceFromMarkdown(md)).toBe('59,000');
  });
  it('앞 키워드 비판매가(정가/배송)는 건너뛰고 첫 실판매가를 고른다', () => {
    const md = '배송비 3,000원 · 정가 100,000원 · 판매가 59,000원';
    expect(pickPriceFromMarkdown(md)).toBe('59,000');
  });
});

// ── A5/A11: 빈 itemName은 동적 생성/캐시를 타지 않음 ─────────────────────
describe('audit A5/A11: generateRubric empty itemName short-circuit', () => {
  beforeEach(() => clearRubricCache());
  it('빈/공백 itemName은 LLM 호출 없이 [] 반환(캐시 오염·빈 프롬프트 방지)', async () => {
    let calls = 0;
    const llm = new MockLlmClient({}); // 어떤 key도 없음 → 호출되면 throw
    const counting = {
      structured: async (c: StructuredCall<unknown>) => {
        calls++;
        return llm.structured(c);
      },
    } as any;
    expect(await generateRubric(counting, '')).toEqual([]);
    expect(await generateRubric(counting, '   ')).toEqual([]);
    expect(calls).toBe(0); // 실 LLM 경로에서도 호출 안 됨
  });
});
