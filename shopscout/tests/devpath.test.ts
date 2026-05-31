import { describe, it, expect } from 'vitest';
import { runTurn } from '@/lib/orchestrator/orchestrator';
import { DevMockLlmClient } from '@/lib/llm/devMockClient';
import { mockSource } from '@/lib/sources/mockSource';
import { MemoryStore } from '@/lib/store/sqliteStore';

describe('dev/mock 전체 경로 (E2E가 쓰는 경로)', () => {
  it('추천과 요약, 후보 카드 제목을 만든다', async () => {
    const res = await runTurn({
      llm: new DevMockLlmClient(),
      sources: [mockSource],
      store: new MemoryStore(),
      turnKey: 'dev1',
      utterance: '코딩용 무선 키보드 10만원',
    });
    expect(res.kind).toBe('recommendation');
    if (res.kind === 'recommendation') {
      expect(res.recommendation.ranked.length).toBeGreaterThan(0);
      expect(res.recommendation.summary).toBeTruthy();
      const titles = res.recommendation.ranked.map((r) => r.listing.title).join(' ');
      expect(titles).toContain('베이직 모델'); // mockSource의 첫 변형 상품
      expect(titles).toContain('코딩용 무선 키보드');
    }
  });
});
