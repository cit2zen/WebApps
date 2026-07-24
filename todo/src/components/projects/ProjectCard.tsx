import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Project } from '../../types';
import { isProjectDone, projectProgress } from '../../utils/selectors';
import { Badge } from '../common/Badge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ProgressBar } from '../common/ProgressBar';
import { SubtaskItem } from './SubtaskItem';

interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  const addSubtask = useAppStore((s) => s.addSubtask);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const done = isProjectDone(project);
  const percent = projectProgress(project);

  const submitSubtask = () => {
    const title = draft.trim();
    if (!title) return;
    addSubtask(project.id, title);
    setDraft('');
  };

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl p-5 shadow-sm ${
        done ? 'bg-lavender-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">
          {done && <span className="mr-1 text-lavender-500">✓</span>}
          {project.title}
        </h3>
        <div className="flex shrink-0 gap-2 text-xs">
          <button type="button" onClick={onEdit} className="text-muted hover:text-ink">
            수정
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="text-muted hover:text-rose-pastel-500"
          >
            삭제
          </button>
        </div>
      </div>

      {(done || project.deadline || project.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {done ? (
            <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-medium text-lavender-500">
              완료
            </span>
          ) : (
            <Badge deadline={project.deadline} />
          )}
          {project.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-xs text-muted">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {project.memo && <p className="text-xs text-muted">{project.memo}</p>}

      <ProgressBar percent={percent} />

      {project.subtasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {project.subtasks.map((subtask) => (
            <SubtaskItem key={subtask.id} projectId={project.id} subtask={subtask} />
          ))}
        </ul>
      )}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') submitSubtask();
        }}
        placeholder="+ 세부 할 일 추가 (Enter)"
        className="rounded-xl bg-cream px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-lavender-200"
      />

      <ConfirmDialog
        open={confirmOpen}
        message={`'${project.title}' 프로젝트를 삭제할까요?`}
        onConfirm={() => deleteProject(project.id)}
        onCancel={() => setConfirmOpen(false)}
      />
    </article>
  );
}
