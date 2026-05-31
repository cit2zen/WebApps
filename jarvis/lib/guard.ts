// lib/guard.ts
// 공개 데모를 유지하되 소유자 Claude 구독의 무단·무제한 사용을 막는 경량 게이트.
//  1) 클라이언트당(쿠키 cid) + IP당 레이트리밋
//  2) sessionId 소유권: cid가 만든 sessionId만 resume 허용(타인 대화 resume = IDOR 차단)
// 단일 인스턴스(standalone Docker) 전제의 인메모리 구현. prod 다중 인스턴스 전이 시 Redis로 교체.

const WINDOW_MS = 60_000;          // 1분 창
const MAX_PER_WINDOW = Number(process.env.JARVIS_RATE_LIMIT ?? 8); // cid/IP당 분당 요청

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// sessionId → 소유 cid. resume 시 동일 cid만 허용.
const sessionOwners = new Map<string, string>();

function hit(key: string, now: number): boolean {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count++;
  return true;
}

// 주기적 청소(메모리 누수 방지) — 호출 시 만료 버킷 제거.
function sweep(now: number) {
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
}

export type GuardResult =
  | { ok: true }
  | { ok: false; status: 429 | 403; message: string };

// cid: 미들웨어가 발급한 httpOnly 쿠키 식별자. ip: 보조 키.
export function checkRequest(cid: string, ip: string): GuardResult {
  const now = Date.now();
  sweep(now);
  if (!hit(`cid:${cid}`, now) || !hit(`ip:${ip}`, now)) {
    return { ok: false, status: 429, message: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요." };
  }
  return { ok: true };
}

// resume 요청의 sessionId가 cid 소유인지 검증. 미지정/신규 세션은 통과(소유자 등록은 done에서).
export function checkSessionOwner(cid: string, sessionId: string | undefined): GuardResult {
  if (!sessionId) return { ok: true };
  const owner = sessionOwners.get(sessionId);
  if (owner && owner !== cid) {
    return { ok: false, status: 403, message: "이 대화에 접근할 수 없어요." };
  }
  return { ok: true };
}

// 서버가 새 sessionId를 발급(done 이벤트)했을 때 소유자 등록.
export function bindSession(cid: string, sessionId: string) {
  if (!sessionOwners.has(sessionId)) sessionOwners.set(sessionId, cid);
}
