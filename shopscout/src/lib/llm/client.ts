import type { ZodType } from 'zod';

export interface StructuredCall<T> {
  key: string; // 캐시/목 식별자
  system: string;
  prompt: string;
  schema: ZodType<T>;
}

export interface LlmClient {
  structured<T>(call: StructuredCall<T>): Promise<T>;
  /**
   * 이미지(URL)를 함께 입력하는 구조화 호출 (E8, 멀티모달).
   * 지원하는 구현만 정의한다. 미지원이면 호출자가 structured로 폴백한다.
   */
  structuredWithImages?<T>(call: StructuredCall<T>, imageUrls: string[]): Promise<T>;
}
