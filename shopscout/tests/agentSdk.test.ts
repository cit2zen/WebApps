import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { AgentSdkClient, extractJson, isNonRetryable } from '@/lib/llm/agentSdkClient';

// Agent SDK(query)를 목으로 대체해 run()이 전달하는 옵션을 캡처한다.
// vi.hoisted: vi.mock 팩토리가 끌어올려져도 안전하게 참조할 수 있는 캡처 배열.
const { queryCalls } = vi.hoisted(() => ({
  queryCalls: [] as Array<{ prompt: unknown; options?: Record<string, unknown> }>,
}));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: { prompt: unknown; options?: Record<string, unknown> }) => {
    queryCalls.push(args);
    const maxTurns = Number(args.options?.maxTurns ?? 0);
    // 실측 제약 재현: json_schema 구조화 출력은 최소 2턴이 필요하다.
    // maxTurns<2면 결과 직전에 잘려 SDK가 error_max_turns를 돌려준다.
    return (async function* () {
      if (maxTurns >= 2) {
        yield { type: 'result', subtype: 'success', is_error: false, structured_output: { ok: true } };
      } else {
        yield { type: 'result', subtype: 'error_max_turns', is_error: true };
      }
    })();
  },
}));

describe('extractJson', () => {
  const schema = z.object({ score: z.number() });
  it('코드펜스 안의 JSON을 파싱·검증한다', () => {
    const out = extractJson('설명\n```json\n{"score": 80}\n```\n뒷말', schema);
    expect(out.score).toBe(80);
  });
  it('언어 표기 없는 코드펜스도 처리', () => {
    expect(extractJson('```\n{"score": 5}\n```', schema).score).toBe(5);
  });
  it('맨몸 JSON도 파싱한다', () => {
    expect(extractJson('앞 {"score": 12} 뒤', schema).score).toBe(12);
  });
  it('스키마 불일치는 throw', () => {
    expect(() => extractJson('{"score":"x"}', schema)).toThrow();
  });
  it('JSON 없으면 throw', () => {
    expect(() => extractJson('no json here', schema)).toThrow();
  });
});

describe('isNonRetryable', () => {
  it('명시된 비재시도성 subtype들은 true', () => {
    for (const s of [
      'error_max_budget_usd',
      'error_max_structured_output_retries',
      'error_during_execution',
      'error_max_turns',
      'prompt_too_long',
    ]) {
      expect(isNonRetryable(s)).toBe(true);
    }
  });

  it("알 수 없는 'error_*' subtype도 비재시도성으로 본다", () => {
    expect(isNonRetryable('error_unknown_thing')).toBe(true);
  });

  it('정상/일시적 케이스는 재시도 대상(false)', () => {
    expect(isNonRetryable('success')).toBe(false);
    expect(isNonRetryable(undefined)).toBe(false);
    expect(isNonRetryable(null)).toBe(false);
    expect(isNonRetryable('')).toBe(false);
    expect(isNonRetryable(123)).toBe(false);
    expect(isNonRetryable('timeout')).toBe(false);
  });
});

describe('AgentSdkClient.run (회귀: maxTurns)', () => {
  it('구조화 출력에 필요한 maxTurns(>=2)을 SDK에 전달하고 결과를 받는다', async () => {
    queryCalls.length = 0;
    const out = await new AgentSdkClient().structured({
      key: 'purpose:regress',
      system: 'sys',
      prompt: 'hi',
      schema: z.object({ ok: z.boolean() }),
    });
    // maxTurns:1(과거 버그)이면 목이 error_max_turns를 돌려 structured가 throw → 실패.
    expect(out).toEqual({ ok: true });
    expect(queryCalls).toHaveLength(1);
    expect(Number(queryCalls[0].options?.maxTurns)).toBeGreaterThanOrEqual(2);
  });
});
