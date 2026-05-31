import { runTurn } from '@/lib/orchestrator/orchestrator';
import { makeLlm } from '@/lib/llm/factory';
import { resolveSources } from '@/lib/sources/registry';
import { getStore } from '@/lib/store/factory';
import { withKeyedLock } from '@/lib/util/keyedLock';
import { rateLimit } from '@/lib/util/rateLimit';
import { config } from '@/lib/config';

export const runtime = 'nodejs';

/** 클라이언트 제공 키를 그대로 저장 PK로 쓰지 않도록 형식 검증 */
function isValidTurnKey(k: unknown): k is string {
  return typeof k === 'string' && k.length > 0 && k.length <= 128 && /^[\w:-]+$/.test(k);
}

/** E4: 저장된 대화(직전 추천)를 turnKey로 복원 */
export async function GET(req: Request) {
  const turnKey = new URL(req.url).searchParams.get('turnKey');
  if (!isValidTurnKey(turnKey)) {
    return Response.json({ kind: 'empty' });
  }
  try {
    const store = await getStore();
    const conv = await store.getConversation(turnKey);
    if (!conv) return Response.json({ kind: 'empty' });
    return Response.json({
      kind: 'history',
      intent: conv.intent ?? null,
      recommendation: conv.lastRecommendation ?? null,
    });
  } catch (e) {
    console.error('[chat] GET 복원 실패:', e);
    return Response.json({ kind: 'empty' });
  }
}

export async function POST(req: Request) {
  let body: { turnKey?: string; utterance?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ kind: 'error', message: '잘못된 요청 본문' }, { status: 400 });
  }
  const { turnKey, utterance } = body;
  if (!isValidTurnKey(turnKey) || typeof utterance !== 'string' || !utterance.trim()) {
    return Response.json({ kind: 'error', message: 'turnKey와 utterance가 필요합니다.' }, { status: 400 });
  }
  // DoS 방어: 발화 길이 제한 + turnKey별 레이트리밋(요청당 다수 LLM 호출 폭증 방지)
  if (utterance.length > config.maxUtteranceLength) {
    return Response.json({ kind: 'error', message: '입력이 너무 깁니다.' }, { status: 413 });
  }
  if (!rateLimit(turnKey, 10, 60_000, Date.now())) {
    return Response.json({ kind: 'error', message: '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  // NDJSON 스트림: 진행 이벤트들 + 마지막 결과 한 줄 (E7)
  const encoder = new TextEncoder();
  // 클라이언트가 연결을 끊으면(탭 닫기/네비게이션) runTurn을 중단시킨다.
  const abort = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 이미 스트림이 닫히는 중이면 enqueue가 실패할 수 있으므로 감싼다.
      const write = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        } catch {
          /* 닫히는 중: 무시 */
        }
      };
      try {
        const res = await withKeyedLock(turnKey, async () =>
          runTurn({
            llm: makeLlm(),
            sources: resolveSources(),
            store: await getStore(),
            turnKey,
            utterance,
            onProgress: (e) => write({ type: 'progress', ...e }),
            signal: abort.signal,
          }),
        );
        write({ type: 'result', ...res });
      } catch (e) {
        // abort(연결 종료)는 정상 흐름으로 간주하고 조용히 닫는다.
        if (abort.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          // 추가 출력 없음
        } else {
          console.error('[chat] runTurn 실패:', e);
          write({ type: 'result', kind: 'error', message: '처리 중 오류가 발생했습니다.' });
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* 이미 닫힘: 무시 */
        }
      }
    },
    // 스트림이 취소되면(클라이언트 연결 종료) runTurn에 중단 신호를 보낸다.
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
