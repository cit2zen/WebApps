import { type ZodType } from 'zod';
import type { LlmClient, StructuredCall } from './client';
import { toStrictJsonSchema } from './jsonSchema';
import { Semaphore } from './semaphore';
import { isSafeImageUrl } from './urlGuard';

/** 외부 Agent SDK 동시 호출 상한 (레이트리밋·자원 폭증 방지) */
const sdkSemaphore = new Semaphore(Number(process.env.SHOPSCOUT_LLM_CONCURRENCY ?? 6));

/**
 * 구조화 출력(outputFormat: json_schema) 호출의 maxTurns 상한.
 * Agent SDK는 모델 응답 후 결과를 스키마로 강제하는 추가 라운드트립을 거쳐
 * json_schema 출력에 최소 2턴이 든다. maxTurns:1이면 결과 직전에 잘려 매 호출이
 * error_max_turns로 실패한다(실측: 1=실패, 2·3·6=성공·동일 결과).
 * tools:[]로 에이전트 루프가 없으므로 상한을 약간 높여도 실제 사용 턴은 늘지 않아
 * 스키마 보정 1회분 여유를 둬 4로 설정한다.
 */
const STRUCTURED_OUTPUT_MAX_TURNS = 4;

/**
 * 모델 응답 텍스트에서 JSON을 추출하고 zod 스키마로 검증한다(폴백 경로).
 * 여러 후보(통째 파싱 → 코드펜스 → 첫'{'~마지막'}')를 순서대로 시도해 산문 섞인 출력에도 견고하다(bug33/35).
 */
export function extractJson<T>(text: string, schema: ZodType<T>): T {
  const candidates: string[] = [];
  const trimmed = text.trim();
  if (trimmed) candidates.push(trimmed);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1].trim());
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) candidates.push(text.slice(start, end + 1).trim());

  let lastErr: unknown;
  for (const c of candidates) {
    try {
      return schema.parse(JSON.parse(c));
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`응답에서 유효한 JSON을 찾지 못했습니다: ${(lastErr as Error)?.message ?? '후보 없음'}`);
}

export interface AgentSdkOptions {
  model?: string;
  maxRetries?: number;
}

/**
 * 재시도해도 의미 없는(영구·정책성) 에러. 재시도 루프가 즉시 멈추도록 별도 클래스로 구분한다.
 * - 레이트리밋 rejected, 예산 초과, prompt_too_long, 구조화 출력 재시도 소진 등
 */
export class NonRetryableAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableAgentError';
  }
}

/** 비재시도성으로 간주하는 result.subtype 목록(SDK 실제 값을 모를 수 있어 방어적으로 문자열 비교) */
const NON_RETRYABLE_SUBTYPES = new Set([
  'error_max_budget_usd',
  'error_max_structured_output_retries',
  'error_during_execution',
  'error_max_turns',
  'prompt_too_long',
]);

/**
 * result 메시지의 subtype이 재시도 불가 에러인지 판정한다(테스트 가능하도록 export).
 * - 정상 결과(예: 'success')나 undefined는 false.
 * - 'error'로 시작하는 임의 subtype도 보수적으로 비재시도성으로 본다.
 */
export function isNonRetryable(subtype: unknown): boolean {
  if (typeof subtype !== 'string' || subtype.length === 0) return false;
  if (NON_RETRYABLE_SUBTYPES.has(subtype)) return true;
  // success / 정상 계열은 재시도 대상 아님(에러 아님)
  if (subtype === 'success') return false;
  // 알 수 없는 'error_*' / 'prompt_too_long' 류는 영구 에러로 취급
  return subtype.startsWith('error');
}

/**
 * Claude Agent SDK 기반 LlmClient.
 * Claude Code 구독 로그인 세션의 자격증명을 사용한다(별도 API 키 불필요).
 * SDK의 네이티브 구조화 출력(outputFormat: json_schema)을 사용하고,
 * 실패 시 결과 텍스트에서 JSON을 추출하는 폴백을 둔다.
 */
export class AgentSdkClient implements LlmClient {
  constructor(private opts: AgentSdkOptions = {}) {}

  async structured<T>(call: StructuredCall<T>): Promise<T> {
    return this.run(call, (prompt) => prompt);
  }

  async structuredWithImages<T>(call: StructuredCall<T>, imageUrls: string[]): Promise<T> {
    const blocks = await fetchImageBlocks(imageUrls.slice(0, 4));
    if (blocks.length === 0) return this.structured(call); // 이미지 수집 실패 시 텍스트 폴백
    // 스트리밍 입력 모드: 텍스트 + 이미지 블록을 담은 user 메시지 생성기
    const makeGen = (text: string) =>
      (async function* () {
        yield {
          type: 'user' as const,
          message: { role: 'user' as const, content: [{ type: 'text', text }, ...blocks] },
        };
      })();
    return this.run(call, makeGen);
  }

  /** prompt(문자열 또는 스트리밍 생성기)를 받아 구조화 출력으로 실행하는 공통 경로 */
  private async run<T>(
    call: StructuredCall<T>,
    buildPrompt: (text: string) => unknown,
  ): Promise<T> {
    const mod = await import('@anthropic-ai/claude-agent-sdk');
    const query = mod.query as (args: { prompt: unknown; options?: Record<string, unknown> }) => AsyncIterable<
      Record<string, unknown>
    >;

    const jsonSchema = toStrictJsonSchema(call.schema);
    const retries = this.opts.maxRetries ?? 2;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const options: Record<string, unknown> = {
          systemPrompt: call.system,
          outputFormat: { type: 'json_schema', schema: jsonSchema },
          maxTurns: STRUCTURED_OUTPUT_MAX_TURNS,
          tools: [],
        };
        if (this.opts.model) options.model = this.opts.model;

        const { structured, resultText, assistantText } = await sdkSemaphore.run(async () => {
          let structured: unknown;
          let resultText = '';
          let assistantText = '';
          let totalCost = 0; // 비용 누적(있을 때만)
          for await (const msg of query({ prompt: buildPrompt(call.prompt), options })) {
            const m = msg as Record<string, any>;

            // 비용 관측: total_cost_usd가 실리는 메시지가 있으면 누적
            if (typeof m.total_cost_usd === 'number') totalCost += m.total_cost_usd;

            // 레이트리밋 감지: SDK 버전마다 필드 경로가 달라(rate_limit_event / rate_limit_info / rateLimit,
            // 그리고 status가 한 단계 더 중첩되기도 함) 여러 경로를 모두 살핀다(bug23).
            // status === 'rejected'면 재시도해봐야 한도가 풀리지 않으므로 즉시 비재시도성 처리.
            const rl =
              m.rate_limit_event ?? m.rate_limit_info ?? m.rateLimit ?? (m.type === 'rate_limit_event' ? m : undefined);
            const rlStatus = rl?.status ?? rl?.rate_limit_info?.status ?? rl?.rate_limit?.status;
            if (rlStatus === 'rejected') {
              const resetsAt = rl.resetsAt ?? rl.resets_at ?? rl.rate_limit_info?.resetsAt;
              throw new NonRetryableAgentError(
                `레이트리밋 거부(rejected)${resetsAt ? `, 재개 예정: ${resetsAt}` : ''}`,
              );
            }

            if (m.type === 'result') {
              // 비재시도성 에러(예산초과·구조화재시도소진·실행오류 등)는 즉시 중단
              if (m.is_error === true || isNonRetryable(m.subtype)) {
                const reason = m.subtype ?? (m.is_error ? 'is_error' : 'unknown');
                throw new NonRetryableAgentError(`Agent SDK 결과 에러: ${String(reason)}`);
              }
              if (m.structured_output != null) structured = m.structured_output;
              if (typeof m.result === 'string') resultText += m.result;
              continue;
            }
            if (m.type === 'assistant') {
              const content = m.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block?.type === 'text' && typeof block.text === 'string') {
                    assistantText += block.text;
                  }
                }
              }
            }
          }
          if (totalCost > 0) console.info(`[AgentSdkClient] ${call.key} 누적 비용: $${totalCost.toFixed(6)}`);
          return { structured, resultText, assistantText };
        });

        // structured_output이 스키마와 맞으면 그대로, 아니면(문자열/래핑 등) 텍스트 추출로 폴백(bug24)
        if (structured != null) {
          const parsed = call.schema.safeParse(structured);
          if (parsed.success) return parsed.data;
        }
        const text =
          resultText || assistantText || (typeof structured === 'string' ? structured : '');
        if (text) return extractJson(text, call.schema);
        throw new Error('Agent SDK 응답이 비었습니다.');
      } catch (e) {
        lastErr = e;
        // 비재시도성(레이트리밋 rejected·예산초과·prompt_too_long 등)은 즉시 throw — 무의미한 재시도 차단
        if (e instanceof NonRetryableAgentError) {
          throw new Error(`AgentSdkClient 비재시도성 실패(${call.key}): ${e.message}`);
        }
        // 마지막 시도면 더 자지 않는다(불필요한 지연/비용 방지, bug32)
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
        }
      }
    }
    throw new Error(`AgentSdkClient 실패(${call.key}): ${String(lastErr)}`);
  }
}

const IMAGE_FETCH_TIMEOUT = 8000;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** 이미지 URL들을 base64 image 블록으로 변환(실패는 건너뜀) — Agent SDK·API 클라이언트 공용 */
export async function fetchImageBlocks(
  urls: string[],
): Promise<Array<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } }>> {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        // SSRF 방지: 스크랩된 신뢰불가 URL이 내부 대역을 향하지 못하게 검사
        if (!(await isSafeImageUrl(url))) return null;
        // redirect:'manual' — 리다이렉트로 내부 대역 우회하는 것을 차단(3xx면 폐기)
        const res = await fetch(url, {
          signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT),
          redirect: 'manual',
        });
        if (res.status >= 300 && res.status < 400) return null;
        if (!res.ok) return null;
        const ct = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim().toLowerCase();
        // Anthropic이 지원하는 이미지 타입만 허용
        if (!SUPPORTED_IMAGE_TYPES.has(ct)) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > 5_000_000) return null; // 5MB 상한
        return {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: ct, data: buf.toString('base64') },
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((b): b is NonNullable<typeof b> => b != null);
}
