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
      className="w-full rounded-2xl bg-white px-4 py-3 text-base shadow-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-mint-200 sm:text-sm"
    />
  );
}
