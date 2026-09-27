import { motion } from 'motion/react';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SimpleTask } from '../../types';
import { parseTags } from '../../utils/tags';
import { Badge } from '../common/Badge';
import { Checkbox } from '../common/Checkbox';
import { ConfirmDialog } from '../common/ConfirmDialog';

const inputClass = 'pol-input td-input-compact';

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
      className="td-item"
    >
      <div className="td-item-row">
        <Checkbox checked={task.done} onChange={() => toggleTask(task.id)} accent="mint" />
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="td-item-main"
        >
          <span
            className={`td-item-title ${expanded ? 'break-words [overflow-wrap:anywhere]' : 'truncate'}${
              task.done ? ' is-done' : ''
            }`}
          >
            {task.title}
          </span>
          {!task.done && <Badge deadline={task.deadline} />}
          <span
            className={`td-chevron${expanded ? ' is-open' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        <button
          type="button"
          aria-label="할 일 삭제"
          onClick={() => setConfirmOpen(true)}
          className="td-icon-btn is-danger"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="td-item-edit">
          <label className="pol-field">
            <span className="pol-field-label">제목</span>
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
          <label className="pol-field">
            <span className="pol-field-label">마감일</span>
            <input
              type="date"
              value={task.deadline ?? ''}
              onChange={(e) =>
                updateTask(task.id, { deadline: e.target.value || undefined })
              }
              className={inputClass}
            />
          </label>
          <label className="pol-field">
            <span className="pol-field-label">태그 (쉼표로 구분)</span>
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
          <label className="pol-field">
            <span className="pol-field-label">메모</span>
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
              className="pol-textarea td-input-compact"
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
