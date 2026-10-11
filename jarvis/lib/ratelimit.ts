// lib/ratelimit.ts
// 단일 인스턴스(standalone Docker) 전제의 인메모리 슬라이딩 윈도 레이트리밋 + 클라이언트 IP 추출.

// Cloudflare Tunnel 뒤: cf-connecting-ip가 실제 클라이언트. 그다음 XFF 첫 값.
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

const hits = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, arr] of hits) {
    // 키의 창 길이를 모르므로 1시간 지난 기록만 제거(모든 창 ≤ 10분).
    if (!arr.length || now - arr[arr.length - 1] > 3_600_000) hits.delete(k);
  }
}

// 허용이면 true(기록 추가), 초과면 false.
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  sweep(now);
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export function tooMany(): Response {
  return Response.json(
    { error: "rate_limited", message: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요." },
    { status: 429, headers: { "Cache-Control": "no-store" } },
  );
}
