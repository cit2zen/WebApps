import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, StructuredCall } from './client';
import { extractJson, fetchImageBlocks } from './agentSdkClient';
import { toStrictJsonSchema } from './jsonSchema';
import { Semaphore } from './semaphore';

/** 외부 API 동시 호출 상한 */
const sem = new Semaphore(Number(process.env.SHOPSCOUT_LLM_CONCURRENCY ?? 6));

const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * Anthropic Messages API 기반 LlmClient — 서버 배포용(ANTHROPIC_API_KEY 사용).
 * Agent SDK(구독·CLI)와 달리 서버 런타임에서 안정적으로 동작한다.
 * - 구조화 출력(output_config.format json_schema) + 시스템 프롬프트 캐싱(요소별 system 재사용으로 캐시 적중)
 */
export class ApiLlmClient implements LlmClient {
  private client: Anthropic;
  private model: string;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY가 필요합니다 (SHOPSCOUT_LLM=api). console.anthropic.com에서 발급하세요.');
    }
    this.client = new Anthropic({ apiKey });
    this.model = opts.model ?? process.env.SHOPSCOUT_MODEL ?? DEFAULT_MODEL;
  }

  async structured<T>(call: StructuredCall<T>): Promise<T> {
    return this.run(call, [{ type: 'text', text: call.prompt }]);
  }

  async structuredWithImages<T>(call: StructuredCall<T>, imageUrls: string[]): Promise<T> {
    const blocks = await fetchImageBlocks(imageUrls.slice(0, 4));
    if (blocks.length === 0) return this.structured(call);
    return this.run(call, [{ type: 'text', text: call.prompt }, ...(blocks as any[])]);
  }

  private async run<T>(call: StructuredCall<T>, content: any[]): Promise<T> {
    // 미지원 키워드($schema·minimum·default 등)를 정리한 엄격 스키마 — raw 스키마는 API가 400으로 거부
    const jsonSchema = toStrictJsonSchema(call.schema);
    return sem.run(async () => {
      const res = await this.client.messages.create({
        model: this.model,
        // 병합 평가/카테고리 JSON은 커질 수 있어 4096이면 중간에 잘려 파싱 실패한다(bug25). 넉넉히 상향.
        max_tokens: 8192,
        // 시스템 프롬프트는 요소별로 안정적이므로 캐싱 → 같은 턴 내 매물들에서 캐시 적중
        system: [{ type: 'text', text: call.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
        // 구조화 출력 — JSON 스키마로 응답 형식 제약
        output_config: { format: { type: 'json_schema', schema: jsonSchema } },
      } as any);
      const text = (res.content as any[])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return extractJson(text, call.schema);
    });
  }
}
