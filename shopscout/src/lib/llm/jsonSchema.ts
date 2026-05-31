import { z } from 'zod';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

/**
 * zod 스키마를 구조화 출력 API가 허용하는 "엄격" JSON 스키마로 변환한다.
 *
 * z.toJSONSchema()는 `$schema`·`minimum`/`maximum`·`default` 등 structured-outputs가
 * 거부하는 키워드를 그대로 방출한다. SDK transform(jsonSchemaOutputFormat)이 이들을
 * description으로 옮기고 모든 object에 additionalProperties:false를 강제해 400을 막는다.
 * (수치 경계는 description으로 옮겨져 서버 강제는 풀리지만, 호출부가 zod로 재검증하므로 의미는 보존된다.)
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema) as { type: 'object' } & Record<string, unknown>;
  return jsonSchemaOutputFormat(raw).schema as Record<string, unknown>;
}
