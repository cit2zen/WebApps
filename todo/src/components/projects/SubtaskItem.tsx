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

  const startEditing = () => {
    setDraft(subtask.title);
    setEditing(true);
  };

  const commit = () => {
    const title = draft.trim();
    if (title) renameSubtask(projectId, subtask.id, title);
    else setDraft(subtask.title);
    setEditing(false);
  };

  return (
    <li className="group flex items-center gap-2">
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
          className="min-w-0 flex-1 rounded-lg border border-lavender-200 px-2 py-0.5 text-base outline-none sm:text-sm"
        />
      ) : (
        <span
          onDoubleClick={startEditing}
          title="더블클릭 또는 ✎ 버튼으로 수정"
          className={`min-w-0 flex-1 text-sm break-words [overflow-wrap:anywhere] ${
            subtask.done ? 'text-muted line-through' : ''
          }`}
        >
          {subtask.title}
        </span>
      )}
      {!editing && (
        <button
          type="button"
          aria-label="세부 할 일 이름 수정"
          onClick={startEditing}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs text-muted/60 transition-colors hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
        >
          ✎
        </button>
      )}
      <button
        type="button"
        aria-label="세부 할 일 삭제"
        onClick={() => deleteSubtask(projectId, subtask.id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-muted/60 transition-colors hover:bg-rose-pastel-100/50 hover:text-rose-pastel-500"
      >
        ×
      </button>
    </li>
  );
}
