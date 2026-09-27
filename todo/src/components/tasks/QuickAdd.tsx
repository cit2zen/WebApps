import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function QuickAdd() {
  const addTask = useAppStore((s) => s.addTask);
  const [draft, setDraft] = useState('');

  return (
    <input
      id="quick-add"
      autoFocus
      autoComplete="off"
      enterKeyHint="done"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') {
          const title = draft.trim();
          if (!title) return;
          addTask(title);
          setDraft('');
        }
      }}
      placeholder="할 일을 입력하고 Enter"
      aria-label="할 일 빠른 추가"
      className="pol-input td-quick"
    />
  );
}
