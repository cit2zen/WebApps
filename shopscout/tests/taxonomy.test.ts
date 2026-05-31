import { describe, it, expect, beforeEach } from 'vitest';
import { resolveRubric } from '@/lib/taxonomy/resolver';
import { classifyCategory } from '@/lib/taxonomy/classify';
import { resolveRubricForIntent } from '@/lib/taxonomy/rubric';
import { clearRubricCache, generateRubric, rubricCacheKey } from '@/lib/taxonomy/dynamic';
import { MockLlmClient } from '@/lib/llm/mockClient';
import { emptyIntent } from '@/lib/types';
import type { Taxonomy } from '@/lib/taxonomy/types';

const TAX: Taxonomy = {
  version: 'test',
  nodes: [
    {
      id: 'food',
      name: '식품',
      parent: 'root',
      keywords: ['식품', '먹거리'],
      scrapeHints: ['영양성분표', '유통기한'],
      criteria: [{ key: 'expiry', label: '유통기한', check: '유통기한 충분?', dataNeeded: ['유통기한'], weight: 0.3, redFlags: ['임박'] }],
    },
    {
      id: 'food.supplement',
      name: '건강기능식품',
      parent: 'food',
      keywords: ['비타민', '영양제'],
      scrapeHints: ['성분함량', '인증'],
      criteria: [{ key: 'dosage', label: '함량', check: '1일권장량 적합?', dataNeeded: ['함량'], weight: 0.4, redFlags: ['과다'] }],
    },
    {
      id: 'general',
      name: '범용',
      parent: 'root',
      keywords: [],
      scrapeHints: ['가격'],
      criteria: [{ key: 'value', label: '가성비', check: '가격 대비 가치?', dataNeeded: ['가격'], weight: 0.5, redFlags: [] }],
    },
  ],
};

beforeEach(() => clearRubricCache());

describe('resolveRubric (상속 병합)', () => {
  it('리프 노드는 부모 기준을 상속한다', () => {
    const r = resolveRubric(TAX, 'food.supplement')!;
    const keys = r.criteria.map((c) => c.key);
    expect(keys).toContain('expiry'); // 부모(food)
    expect(keys).toContain('dosage'); // 자식
    expect(r.scrapeHints).toContain('영양성분표'); // 부모 힌트
    expect(r.scrapeHints).toContain('성분함량'); // 자식 힌트
  });
  it('없는 노드는 null', () => {
    expect(resolveRubric(TAX, 'nope')).toBeNull();
  });
});

describe('classifyCategory', () => {
  it('LLM이 고른 유효 노드 id를 반환', async () => {
    const llm = new MockLlmClient({ 'classify:비타민C': { nodeId: 'food.supplement', itemName: '비타민C', confidence: 0.9 } });
    const c = await classifyCategory(llm, TAX, emptyIntent('비타민C'), '비타민C');
    expect(c.nodeId).toBe('food.supplement');
  });
  it('없는 id는 general로 폴백', async () => {
    const llm = new MockLlmClient({ 'classify:x': { nodeId: 'invalid', itemName: 'x', confidence: 0.9 } });
    const c = await classifyCategory(llm, TAX, emptyIntent('x'), 'x');
    expect(c.nodeId).toBe('general');
  });
});

describe('resolveRubricForIntent', () => {
  it('구체 리프 분류 → 상속 기준, dynamic=false', async () => {
    const llm = new MockLlmClient({
      'classify:비타민C': { nodeId: 'food.supplement', itemName: '비타민C', confidence: 0.9 },
    });
    const r = await resolveRubricForIntent(llm, TAX, { ...emptyIntent('비타민C') });
    expect(r.dynamic).toBe(false);
    expect(r.criteria.map((c) => c.key)).toContain('dosage');
  });

  it('사용자가 대화로 추가한 extraCriteria가 루브릭에 병합된다', async () => {
    const llm = new MockLlmClient({
      'classify:비타민C': { nodeId: 'food.supplement', itemName: '비타민C', confidence: 0.9 },
    });
    const intent = { ...emptyIntent('비타민C'), extraCriteria: ['비건 인증', '캡슐 크기'] };
    const r = await resolveRubricForIntent(llm, TAX, intent);
    const labels = r.criteria.map((c) => c.label);
    expect(labels).toContain('비건 인증');
    expect(labels).toContain('캡슐 크기');
    expect(labels).toContain('함량'); // 기존 카테고리 기준 유지
    expect(r.scrapeHints).toContain('비건 인증'); // 스크랩 힌트에도 추가
  });

  it('general 분류 → 동적 생성 기준 병합, dynamic=true', async () => {
    const llm = new MockLlmClient({
      'classify:희귀품목': { nodeId: 'general', itemName: '희귀품목', confidence: 0.4 },
      [`rubric:${rubricCacheKey('희귀품목')}`]: { criteria: [{ key: 'special', label: '특수', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] }] },
    });
    const r = await resolveRubricForIntent(llm, TAX, { ...emptyIntent('희귀품목') });
    expect(r.dynamic).toBe(true);
    const keys = r.criteria.map((c) => c.key);
    expect(keys).toContain('value'); // general 기본
    expect(keys).toContain('special'); // 동적 생성
  });

  it('실제 부서 노드를 confidence 높게 분류 → 상속 기준 그대로, dynamic=false (버그A)', async () => {
    // 부서 노드(food, parent===root)라도 확신 있게 골랐으면 동적 생성하지 않고 상속 기준을 쓴다.
    const llm = new MockLlmClient({
      'classify:사과': { nodeId: 'food', itemName: '사과', confidence: 0.85 },
    });
    const r = await resolveRubricForIntent(llm, TAX, { ...emptyIntent('사과') });
    expect(r.dynamic).toBe(false);
    expect(r.criteria.map((c) => c.key)).toContain('expiry'); // food 부서 상속 기준
  });

  it('낮은 confidence면 부서 노드여도 동적 생성, dynamic=true', async () => {
    const llm = new MockLlmClient({
      'classify:애매품목': { nodeId: 'food', itemName: '애매품목', confidence: 0.3 },
      [`rubric:${rubricCacheKey('애매품목')}`]: { criteria: [{ key: 'special', label: '특수', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] }] },
    });
    const r = await resolveRubricForIntent(llm, TAX, { ...emptyIntent('애매품목') });
    expect(r.dynamic).toBe(true);
    const keys = r.criteria.map((c) => c.key);
    expect(keys).toContain('expiry'); // food 부서 기준 유지
    expect(keys).toContain('special'); // 동적 생성 병합
  });

  it('general 노드 없는 택소노미: invalid 폴백 시 최소 공통 기준이 채워진다 (버그B)', async () => {
    // 'general' 노드가 없으므로 resolveRubric('general')=null → base.criteria가 비어 ⓕ가 평가 불가였던 버그.
    const NO_GENERAL: Taxonomy = { version: 'test', nodes: TAX.nodes.filter((n) => n.id !== 'general') };
    const llm = new MockLlmClient({
      'classify:정체불명': { nodeId: 'invalid', itemName: '정체불명', confidence: 0.9 },
      [`rubric:${rubricCacheKey('정체불명')}`]: { criteria: [{ key: 'special', label: '특수', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] }] },
    });
    const r = await resolveRubricForIntent(llm, NO_GENERAL, { ...emptyIntent('정체불명') });
    expect(r.dynamic).toBe(true); // invalid→general 폴백이라 동적 생성
    const keys = r.criteria.map((c) => c.key);
    expect(keys).toContain('value'); // GENERAL_FALLBACK 최소 공통 기준
    expect(keys).toContain('trust');
    expect(keys).toContain('fitness');
    expect(keys).toContain('special'); // 동적 생성 병합
    expect(r.criteria.length).toBeGreaterThan(0); // ⓕ가 평가할 거리가 있음
  });
});

describe('generateRubric 캐시 동작', () => {
  // prompt에 itemName이 들어가므로 호출 횟수를 세서 LLM 호출 여부 검증
  function countingLlm(itemName: string) {
    let calls = 0;
    const llm = new MockLlmClient({
      [`rubric:${rubricCacheKey(itemName)}`]: () => {
        calls++;
        return { criteria: [{ key: 'k', label: 'l', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] }] };
      },
    });
    return { llm, calls: () => calls };
  }

  it('같은 품목명 2회 호출 시 LLM은 1회만 생성한다', async () => {
    const { llm, calls } = countingLlm('수제 라탄 바구니');
    await generateRubric(llm, '수제 라탄 바구니');
    await generateRubric(llm, '수제 라탄 바구니');
    expect(calls()).toBe(1);
  });

  it('다른 품목명은 별도로 생성한다', async () => {
    const a = '수제 라탄 바구니 핸드메이드 빈티지';
    const b = '수제 라탄 바구니 핸드메이드 모던';
    let aCalls = 0;
    let bCalls = 0;
    const llm = new MockLlmClient({
      [`rubric:${rubricCacheKey(a)}`]: () => {
        aCalls++;
        return { criteria: [{ key: 'a', label: 'a', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] }] };
      },
      [`rubric:${rubricCacheKey(b)}`]: () => {
        bCalls++;
        return { criteria: [{ key: 'b', label: 'b', check: 'c', dataNeeded: [], weight: 0.3, redFlags: [] }] };
      },
    });
    // 이전(60자 truncate) 구현이면 두 긴 품목명이 같은 키로 충돌했을 것
    expect(rubricCacheKey(a)).not.toBe(rubricCacheKey(b));
    const ra = await generateRubric(llm, a);
    const rb = await generateRubric(llm, b);
    expect(aCalls).toBe(1);
    expect(bCalls).toBe(1);
    expect(ra[0].key).toBe('a');
    expect(rb[0].key).toBe('b'); // 캐시 충돌 없이 각자 기준 반환
  });
});
