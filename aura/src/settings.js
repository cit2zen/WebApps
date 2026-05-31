// API 키 방식 폐기 — 구독(서버 백엔드) 인증을 쓰므로 키가 필요 없다.
// 하위 호환을 위해 인터페이스만 유지하고, 항상 "준비됨"으로 동작한다.
export function getKey() { return 'subscription'; }
export function setKey() { /* no-op */ }
export function hasKey() { return true; }

// 설정 dialog는 더 이상 키 입력을 받지 않는다. gear 버튼이 있으면 안내용으로만 연다.
export function initSettings() {
  const dialog = document.getElementById('settings');
  const gear = document.getElementById('gear');
  if (gear && dialog) gear.addEventListener('click', () => dialog.showModal());
  return { open: () => dialog?.showModal() };
}
