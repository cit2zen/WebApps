// API 키 방식 폐기 — 구독(서버 백엔드) 인증을 쓰므로 키가 필요 없다.
// 하위 호환을 위해 인터페이스만 유지하고, 항상 "준비됨"으로 동작한다.
export function getKey() { return 'subscription'; }
export function setKey() { /* no-op */ }
export function hasKey() { return true; }

// 설정 dialog/gear DOM은 제거됨 — no-op 스텁만 유지.
export function initSettings() {
  return { open: () => {} };
}
