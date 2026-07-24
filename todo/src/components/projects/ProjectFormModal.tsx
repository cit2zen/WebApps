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

const inputClass =
  'w-full rounded-xl bg-cream px-3 py-2 text-base outline-none focus:ring-2 focus:ring-lavender-200 sm:text-sm';

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
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="프로젝트 이름"
          className={inputClass}
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={2}
          className={inputClass}
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="태그 (쉼표로 구분)"
          className={inputClass}
        />
        <label className="flex flex-col gap-1 text-xs text-muted">
          마감일 (선택)
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-cream"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-xl bg-lavender-400 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-lavender-500 disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
