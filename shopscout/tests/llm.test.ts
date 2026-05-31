import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MockLlmClient } from '@/lib/llm/mockClient';

describe('MockLlmClient', () => {
  const schema = z.object({ ok: z.boolean() });
  it('등록된 응답을 반환한다', async () => {
    const c = new MockLlmClient({ greet: { ok: true } });
    const r = await c.structured({ key: 'greet', system: 's', prompt: 'p', schema });
    expect(r).toEqual({ ok: true });
  });
  it('함수형 응답을 지원한다', async () => {
    const c = new MockLlmClient({ greet: (call: { prompt: string }) => ({ ok: call.prompt === 'yes' }) });
    const r = await c.structured({ key: 'greet', system: '', prompt: 'yes', schema });
    expect(r.ok).toBe(true);
  });
  it('미등록 key는 에러', async () => {
    const c = new MockLlmClient({});
    await expect(
      c.structured({ key: 'x', system: '', prompt: '', schema }),
    ).rejects.toThrow();
  });
});
