import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Project } from '../../types';
import { parseTags } from '../../utils/tags';
import { Modal } from '../common/Modal';

interface ProjectFormModalProps {
  open: boolean;
  project?: Project;
  onClose: () => void;
}

const inputClass = 'pol-input td-input-compact';

export function ProjectFormModal({ open, project, onClose }: ProjectFormModalProps) {
  const addProject = useAppStore((s) => s.addProject);
  const updateProject = useAppStore((s) => s.updateProject);
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [tags, setTags] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(project?.title ?? '');
      setMemo(project?.memo ?? '');
      setTags(project?.tags.join(', ') ?? '');
      setDeadline(project?.deadline ?? '');
    }
  }, [open, project]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const input = {
      title: trimmed,
      memo: memo.trim() || undefined,
      tags: parseTags(tags),
      deadline: deadline || undefined,
    };
    if (project) updateProject(project.id, input);
    else addProject(input);
    onClose();
  };

  return (
    <Modal open={open} title={project ? '프로젝트 수정' : '새 프로젝트'} onClose={onClose}>
      <form
        className="td-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="pol-field">
          <span className="pol-field-label">이름</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="프로젝트 이름"
            className={inputClass}
          />
        </label>
        <label className="pol-field">
          <span className="pol-field-label">메모</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택)"
            rows={2}
            className="pol-textarea td-input-compact"
          />
        </label>
        <label className="pol-field">
          <span className="pol-field-label">태그</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="태그 (쉼표로 구분)"
            className={inputClass}
          />
        </label>
        <label className="pol-field">
          <span className="pol-field-label">마감일 (선택)</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="td-form-actions">
          <button type="button" onClick={onClose} className="pol-btn-ghost td-btn">
            취소
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="pol-btn-primary td-btn"
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
