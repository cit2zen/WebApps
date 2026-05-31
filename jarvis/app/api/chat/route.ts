// app/api/chat/route.ts
import { runJarvis } from "@/lib/agent";
import { createEventMapper } from "@/lib/agentEvents";
import { serializeEvent } from "@/lib/sse";

export const runtime = "nodejs";        // 서브프로세스 spawn → Edge 금지
export const dynamic = "force-dynamic"; // 스트리밍, 캐시 없음

// ⚠️ 보안: 이 엔드포인트는 v1에서 의도적으로 인증이 없다 — 로컬 데스크톱·단일 사용자(localhost)
// 전용이기 때문. 사용자 본인의 Claude 구독으로 동작하고 메모리는 단일 로컬 파일이라
// 다중 사용자/IDOR 표면이 없다.
// 배포(v2: 홈서버 + Cloudflare 터널)로 이 엔드포인트가 공개되기 전에는 반드시:
//   1) 인증(세션 쿠키/베어러 토큰) 추가, 2) sessionId를 인증된 사용자에 바인딩(소유권 검증),
//   3) 레이트리밋 — 그렇지 않으면 누구나 사용자의 구독으로 웹검색·대화를 돌릴 수 있다.
export async function POST(req: Request) {
  const { message, sessionId } = (await req.json()) as { message: string; sessionId?: string };
  const encoder = new TextEncoder();
  const mapper = createEventMapper();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const q = runJarvis(message, sessionId, req.signal);
        for await (const msg of q) {
          for (const ev of mapper(msg)) emit(serializeEvent(ev));
        }
      } catch (e) {
        emit(serializeEvent({ type: "error", message: e instanceof Error ? e.message : String(e) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
