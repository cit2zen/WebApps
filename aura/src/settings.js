const KEY = 'aura.anthropic_key';

export function getKey() {
  return localStorage.getItem(KEY) || '';
}
export function setKey(v) {
  if (v) localStorage.setItem(KEY, v.trim());
  else localStorage.removeItem(KEY);
}
export function hasKey() {
  return !!getKey();
}

// 설정 dialog 배선. onSaved(key) 콜백을 저장 시 호출.
export function initSettings(onSaved) {
  const dialog = document.getElementById('settings');
  const gear = document.getElementById('gear');
  const input = document.getElementById('apikey');
  const saveBtn = document.getElementById('save-key');

  gear.addEventListener('click', () => {
    input.value = getKey();
    dialog.showModal();
  });
  saveBtn.addEventListener('click', () => {
    setKey(input.value);
    onSaved?.(getKey());
  });
  return { open: () => dialog.showModal() };
}
