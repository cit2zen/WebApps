import type { LlmClient, StructuredCall } from './client';

/**
 * 결정적 테스트용 목. key별 응답을 등록한다.
 * 함수형 응답도 지원하여 prompt에 따라 동적으로 답할 수 있다.
 */
export class MockLlmClient implements LlmClient {
  constructor(
    private responses: Record<string, unknown | ((call: StructuredCall<unknown>) => unknown)>,
  ) {}

  async structured<T>(call: StructuredCall<T>): Promise<T> {
    if (!(call.key in this.responses)) {
      throw new Error(`Mock 미등록 key: ${call.key}`);
    }
    const r = this.responses[call.key];
    const value = typeof r === 'function' ? (r as (c: StructuredCall<unknown>) => unknown)(call) : r;
    return value as T;
  }

  /** 테스트에서는 이미지를 무시하고 동일 key 응답을 반환 */
  async structuredWithImages<T>(call: StructuredCall<T>): Promise<T> {
    return this.structured(call);
  }
}
