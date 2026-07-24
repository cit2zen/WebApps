import { motion } from 'motion/react';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SimpleTask } from '../../types';
import { parseTags } from '../../utils/tags';
import { Badge } from '../common/Badge';
import { Checkbox } from '../common/Checkbox';
import { ConfirmDialog } from '../common/ConfirmDialog';

const inputClass =
  'w-full rounded-xl bg-cream px-3 py-1.5 text-base outline-none focus:ring-2 focus:ring-mint-200 sm:text-sm';

export function TaskItem({ task }: { task: SimpleTask }) {
  const toggleTask = useAppStore((s) => s.toggleTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [memoDraft, setMemoDraft] = useState('');

  const toggleExpanded = () => {
    if (!expanded) {
      setTitleDraft(task.title);
      setTagsDraft(task.tags.join(', '));
      setMemoDraft(task.memo ?? '');
    }
    setExpanded(!expanded);
  };

  const commitTitle = () => {
    const title = titleDraft.trim();
    if (title && title !== task.title) updateTask(task.id, { title });
    else setTitleDraft(task.title);
  };

  return (
    <motion.li
      layout
      initial={false}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 } }}
      className="rounded-2xl bg-white p-3 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <Checkbox checked={task.done} onChange={() => toggleTask(task.id)} accent="mint" />
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={`flex-1 text-sm ${expanded ? 'break-words [overflow-wrap:anywhere]' : 'truncate'} ${
              task.done ? 'text-muted line-through' : ''
            }`}
          >
            {task.title}
          </span>
          {!task.done && <Badge deadline={task.deadline} />}
          <span
            className={`shrink-0 text-xs text-muted/60 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </button>
        <button
          type="button"
          aria-label="할 일 삭제"
          onClick={() => setConfirmOpen(true)}
          className="-my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted/60 transition-colors hover:bg-rose-pastel-100/50 hover:text-rose-pastel-500"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-cream pt-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            제목
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setTitleDraft(task.title);
                  e.currentTarget.blur();
                }
              }}
              className={inputClass}
            />
          </label>
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
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setTagsDraft(task.tags.join(', '));
                  e.currentTarget.blur();
                }
              }}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            메모
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              onBlur={() => updateTask(task.id, { memo: memoDraft.trim() || undefined })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setMemoDraft(task.memo ?? '');
                  e.currentTarget.blur();
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur();
              }}
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
    </motion.li>
  );
}
