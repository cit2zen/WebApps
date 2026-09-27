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
    <li className="group td-subtask">
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
          aria-label="세부 할 일 이름"
          className="pol-input td-input-inline"
        />
      ) : (
        <span
          onDoubleClick={startEditing}
          title="더블클릭 또는 ✎ 버튼으로 수정"
          className={`td-subtask-text${subtask.done ? ' is-done' : ''}`}
        >
          {subtask.title}
        </span>
      )}
      {!editing && (
        <button
          type="button"
          aria-label="세부 할 일 이름 수정"
          onClick={startEditing}
          className="td-icon-btn is-small sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          ✎
        </button>
      )}
      <button
        type="button"
        aria-label="세부 할 일 삭제"
        onClick={() => deleteSubtask(projectId, subtask.id)}
        className="td-icon-btn is-danger"
      >
        ×
      </button>
    </li>
  );
}
