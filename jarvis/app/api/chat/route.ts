// app/api/chat/route.ts
import { runJarvis } from "@/lib/agent";
import { createEventMapper } from "@/lib/agentEvents";
import { serializeEvent } from "@/lib/sse";
import { checkRequest, checkSessionOwner, bindSession } from "@/lib/guard";

export const runtime = "nodejs";        // 서브프로세스 spawn → Edge 금지
export const dynamic = "force-dynamic"; // 스트리밍, 캐시 없음

// 보안: 이 엔드포인트는 jarvis.cityzen.kr로 공개 배포되며 소유자의 Claude 구독으로 동작한다.
// 익명 무단·무제한 사용을 막기 위해 게이트를 둔다(lib/guard.ts):
//   1) 미들웨어가 발급한 httpOnly 쿠키(jv_cid) + IP당 레이트리밋
//   2) sessionId 소유권 검증 — cid가 만든 세션만 resume(타인 대화 resume = IDOR 차단)
// 더 강력한 차단이 필요하면 Cloudflare Access(Google OAuth/Tailscale)로 전체를 게이트한다.
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

function readCid(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)jv_cid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : `ip:${clientIp(req)}`; // 쿠키 부재 시 IP 폴백
}

function denied(status: number, message: string) {
  const body = serializeEvent({ type: "error", message });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const cid = readCid(req);
  const ip = clientIp(req);

  const rate = checkRequest(cid, ip);
  if (!rate.ok) return denied(rate.status, rate.message);

  const { message, sessionId } = (await req.json()) as { message: string; sessionId?: string };

  if (typeof message !== "string" || !message.trim()) {
    return denied(400, "메시지가 비어 있어요.");
  }
  const own = checkSessionOwner(cid, sessionId);
  if (!own.ok) return denied(own.status, own.message);

  const encoder = new TextEncoder();
  const mapper = createEventMapper();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const q = runJarvis(message, sessionId, req.signal);
        for await (const msg of q) {
          for (const ev of mapper(msg)) {
            // 서버가 새 sessionId를 발급하면 이 cid 소유로 등록(이후 타 cid resume 거부).
            if (ev.type === "done" && ev.sessionId) bindSession(cid, ev.sessionId);
            emit(serializeEvent(ev));
          }
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
