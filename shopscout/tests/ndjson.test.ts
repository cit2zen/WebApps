import { describe, it, expect } from 'vitest';
import { readNdjson } from '@/lib/util/ndjson';

function ndjsonResponse(lines: unknown[]): Response {
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  return rawNdjsonResponse(body);
}

/** 임의의(손상 가능한) 본문 문자열을 그대로 NDJSON 스트림으로 만든다 */
function rawNdjsonResponse(body: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      // 일부러 청크를 줄 중간에서 쪼개 버퍼링 검증
      const bytes = enc.encode(body);
      controller.enqueue(bytes.slice(0, 5));
      controller.enqueue(bytes.slice(5));
      controller.close();
    },
  });
  return new Response(stream);
}

describe('readNdjson', () => {
  it('청크가 줄 중간에서 쪼개져도 줄 단위로 파싱한다', async () => {
    const got: any[] = [];
    await readNdjson(ndjsonResponse([{ type: 'progress', stage: 'searching' }, { type: 'result', kind: 'question' }]), (m) =>
      got.push(m),
    );
    expect(got).toHaveLength(2);
    expect(got[0].stage).toBe('searching');
    expect(got[1].kind).toBe('question');
  });

  it('중간에 깨진 줄이 있어도 유효한 줄(특히 마지막 result)은 모두 처리된다', async () => {
    const got: any[] = [];
    // 정상 progress -> 손상된 부분 JSON -> 정상 result(마지막) 순서
    const body =
      JSON.stringify({ type: 'progress', stage: 'searching' }) +
      '\n' +
      '{"type":"progress","stage":' + // 손상/부분 JSON
      '\n' +
      JSON.stringify({ type: 'result', kind: 'answer' }) +
      '\n';
    await readNdjson(rawNdjsonResponse(body), (m) => got.push(m));
    // 깨진 줄은 건너뛰고 정상 줄 2개만 처리되어야 한다
    expect(got).toHaveLength(2);
    expect(got[0].stage).toBe('searching');
    expect(got[1].kind).toBe('answer');
  });

  it('손상된 줄이 tail(개행 없는 마지막 줄)에 있어도 앞선 result는 처리된다', async () => {
    const got: any[] = [];
    // 마지막 줄에 개행이 없고 손상된 경우 tail 파싱 보호 검증
    const body =
      JSON.stringify({ type: 'result', kind: 'answer' }) +
      '\n' +
      '{"type":"result",broken'; // 개행 없는 손상 tail
    await readNdjson(rawNdjsonResponse(body), (m) => got.push(m));
    expect(got).toHaveLength(1);
    expect(got[0].kind).toBe('answer');
  });
});
