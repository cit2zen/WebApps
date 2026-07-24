import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Subtask } from '../../types';
import { Checkbox } from '../common/Checkbox';

export function SubtaskItem({
  projectId,
  subtask,
}: {
  projectId: string;
  subtask: Subtask;
}) {
  const toggleSubtask = useAppStore((s) => s.toggleSubtask);
  const renameSubtask = useAppStore((s) => s.renameSubtask);
  const deleteSubtask = useAppStore((s) => s.deleteSubtask);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.title);

  const commit = () => {
    const title = draft.trim();
    if (title) renameSubtask(projectId, subtask.id, title);
    else setDraft(subtask.title);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-2">
      <Checkbox
        checked={subtask.done}
        onChange={() => toggleSubtask(projectId, subtask.id)}
        accent="lavender"
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(subtask.title);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-lg border border-lavender-200 px-2 py-0.5 text-sm outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => {
            setDraft(subtask.title);
            setEditing(true);
          }}
          className={`flex-1 text-sm ${subtask.done ? 'text-muted line-through' : ''}`}
        >
          {subtask.title}
        </span>
      )}
      <button
        type="button"
        aria-label="세부 할 일 삭제"
        onClick={() => deleteSubtask(projectId, subtask.id)}
        className="px-1 text-sm text-muted/60 transition-colors hover:text-rose-pastel-500"
      >
        ×
      </button>
    </li>
  );
}
