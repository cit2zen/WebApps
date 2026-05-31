/**
 * 간단한 인메모리 슬라이딩 윈도우 레이트리밋 (단일 프로세스).
 * 키(turnKey 등)별로 windowMs 안에서 max회까지 허용.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now: number): boolean {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false; // 거부
  }
  arr.push(now);
  hits.set(key, arr);
  // 메모리 누수 방지: 가끔 오래된 키 정리
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true; // 허용
}

export function clearRateLimit(): void {
  hits.clear();
}
