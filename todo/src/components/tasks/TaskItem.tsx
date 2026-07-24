import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SimpleTask } from '../../types';
import { parseTags } from '../../utils/tags';
import { Badge } from '../common/Badge';
import { Checkbox } from '../common/Checkbox';
import { ConfirmDialog } from '../common/ConfirmDialog';

const inputClass =
  'w-full rounded-xl bg-cream px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-mint-200';

export function TaskItem({ task }: { task: SimpleTask }) {
  const toggleTask = useAppStore((s) => s.toggleTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tagsDraft, setTagsDraft] = useState('');
  const [memoDraft, setMemoDraft] = useState('');

  const toggleExpanded = () => {
    if (!expanded) {
      setTagsDraft(task.tags.join(', '));
      setMemoDraft(task.memo ?? '');
    }
    setExpanded(!expanded);
  };

  return (
    <li className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Checkbox checked={task.done} onChange={() => toggleTask(task.id)} accent="mint" />
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={`flex-1 truncate text-sm ${task.done ? 'text-muted line-through' : ''}`}
          >
            {task.title}
          </span>
          {!task.done && <Badge deadline={task.deadline} />}
        </button>
        <button
          type="button"
          aria-label="할 일 삭제"
          onClick={() => setConfirmOpen(true)}
          className="px-1 text-sm text-muted/60 transition-colors hover:text-rose-pastel-500"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-cream pt-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            마감일
            <input
              type="date"
              value={task.deadline ?? ''}
              onChange={(e) =>
                updateTask(task.id, { deadline: e.target.value || undefined })
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            태그 (쉼표로 구분)
            <input
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              onBlur={() => updateTask(task.id, { tags: parseTags(tagsDraft) })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            메모
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              onBlur={() => updateTask(task.id, { memo: memoDraft.trim() || undefined })}
              rows={2}
              className={inputClass}
            />
          </label>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message={`'${task.title}' 할 일을 삭제할까요?`}
        onConfirm={() => deleteTask(task.id)}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  );
}
