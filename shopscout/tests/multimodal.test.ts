import { describe, it, expect } from 'vitest';
import { evaluateListing } from '@/lib/evaluation/team';
import type { LlmClient, StructuredCall } from '@/lib/llm/client';
import { emptyIntent, type Listing } from '@/lib/types';

const std = { score: 85, confidence: 0.9, flags: [], rationale: 'r' };
const mergedResult = { a: std, b: std, c: std, d: std, e: std };

/** 이미지 경로 사용 여부를 기록하는 클라이언트 (병합 평가는 호출당 1회) */
class RecordingClient implements LlmClient {
  imageCalls: string[] = [];
  textCalls: string[] = [];
  async structured<T>(call: StructuredCall<T>): Promise<T> {
    this.textCalls.push(call.key);
    return mergedResult as T;
  }
  async structuredWithImages<T>(call: StructuredCall<T>): Promise<T> {
    this.imageCalls.push(call.key);
    return mergedResult as T;
  }
}

const listing: Listing = {
  id: 'kr-1',
  source: 'kr',
  marketplace: '쿠팡',
  url: 'u',
  title: '무선 키보드',
  priceKRW: 30000,
  images: ['https://img/1.jpg', 'https://img/2.jpg'],
  rawSpecs: {},
  raw: {},
};

describe('E8 멀티모달 (병합 평가)', () => {
  it('이미지가 있으면 병합 평가가 이미지 경로(멀티모달)로 1회 호출', async () => {
    const client = new RecordingClient();
    await evaluateListing(client, listing, { ...emptyIntent('무선 키보드'), mustHaves: ['무선'] });
    expect(client.imageCalls).toEqual(['eval:kr-1']); // 단일 병합 호출이 이미지 사용
    expect(client.textCalls).toEqual([]);
  });

  it('이미지가 없으면 텍스트 경로로 1회 호출', async () => {
    const client = new RecordingClient();
    await evaluateListing(client, { ...listing, images: [] }, emptyIntent('무선 키보드'));
    expect(client.imageCalls).toEqual([]);
    expect(client.textCalls).toEqual(['eval:kr-1']);
  });
});
