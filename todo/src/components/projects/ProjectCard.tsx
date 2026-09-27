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
    <article className={`pol-tile td-project${done ? ' is-done' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="td-card-title">
          {done && <span className="td-done-mark">✓</span>}
          {project.title}
        </h3>
        <div className="td-actions">
          <button type="button" onClick={onEdit} className="td-text-btn">
            수정
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="td-text-btn is-danger"
          >
            삭제
          </button>
        </div>
      </div>

      {(done || project.deadline || project.tags.length > 0) && (
        <div className="td-tags">
          {done ? (
            <span className="pol-badge pol-badge-gold">완료</span>
          ) : (
            <Badge deadline={project.deadline} />
          )}
          {project.tags.map((tag) => (
            <span key={tag} className="td-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {project.memo && (
        <p className="td-memo">{project.memo}</p>
      )}

      <ProgressBar percent={percent} />

      {project.subtasks.length > 0 && (
        <ul className="td-subtasks">
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
        autoComplete="off"
        enterKeyHint="done"
        aria-label="세부 할 일 추가"
        className="pol-input td-input-compact"
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
