// app/api/health/route.ts — 인증 없이 열린 헬스체크(proxy.ts PUBLIC_PATHS).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
