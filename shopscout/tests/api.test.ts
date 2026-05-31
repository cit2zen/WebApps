import { describe, it, expect, vi } from 'vitest';
import { MockLlmClient } from '@/lib/llm/mockClient';

// LLM 팩토리를 목으로 대체: 목적 추출이 부족 슬롯을 남겨 되묻기를 유도
vi.mock('@/lib/llm/factory', () => ({
  makeLlm: () =>
    new MockLlmClient({
      'purpose:tA': { category: '키보드', mustHaves: [], niceToHaves: [], dealbreakers: [] },
    }),
}));

// 소스는 호출되지 않지만, 안전하게 목으로 둔다
vi.mock('@/lib/sources/registry', () => ({ resolveSources: () => [] }));

// NDJSON 스트림에서 마지막 result 메시지 추출
async function lastResult(res: Response) {
  const text = await res.text();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  return lines.find((m) => m.type === 'result');
}

describe('chat route (NDJSON 스트림)', () => {
  it('진행 이벤트 후 마지막에 question 결과를 스트리밍', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://x/api/chat', {
      method: 'POST',
      body: JSON.stringify({ turnKey: 'tA', utterance: '키보드' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).toMatch(/"type":"progress"/); // 진행 이벤트 포함
    const result = await lastResult(res);
    expect(result.kind).toBe('question');
    expect(typeof result.question).toBe('string');
  });

  it('필수 필드 누락 시 400', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
