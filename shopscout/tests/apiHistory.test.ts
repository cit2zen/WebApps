import { describe, it, expect, vi } from 'vitest';
import { MemoryStore } from '@/lib/store/sqliteStore';

const store = new MemoryStore();
vi.mock('@/lib/store/factory', () => ({ getStore: async () => store }));

describe('GET /api/chat (history)', () => {
  it('저장된 대화가 없으면 empty', async () => {
    const { GET } = await import('@/app/api/chat/route');
    const res = await GET(new Request('http://x/api/chat?turnKey=none'));
    expect((await res.json()).kind).toBe('empty');
  });

  it('저장된 lastRecommendation을 복원한다', async () => {
    await store.saveConversation({
      id: 'conv-h',
      intent: { rawQuery: 'x', mustHaves: [], niceToHaves: [], dealbreakers: [], extraCriteria: [], priorityHints: [], missingSlots: [] },
      lastRecommendation: { ranked: [], summary: '복원된 요약' },
    });
    const { GET } = await import('@/app/api/chat/route');
    const res = await GET(new Request('http://x/api/chat?turnKey=conv-h'));
    const json = await res.json();
    expect(json.kind).toBe('history');
    expect(json.recommendation.summary).toBe('복원된 요약');
  });

  it('잘못된 turnKey 형식은 empty', async () => {
    const { GET } = await import('@/app/api/chat/route');
    const res = await GET(new Request('http://x/api/chat?turnKey=' + encodeURIComponent('bad key!')));
    expect((await res.json()).kind).toBe('empty');
  });
});
