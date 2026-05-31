// Coolify health check 엔드포인트. 외부 의존 없이 프로세스 생존만 확인한다.
export const runtime = 'nodejs';

export function GET() {
  return Response.json({ ok: true, service: 'shopscout' });
}
