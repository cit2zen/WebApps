import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Project } from '../../types';
import { filterByTag, sortProjects } from '../../utils/selectors';
import { EmptyState } from '../common/EmptyState';
import { ProjectCard } from './ProjectCard';
import { ProjectFormModal } from './ProjectFormModal';

export function ProjectList() {
  const projects = useAppStore((s) => s.projects);
  const selectedTag = useAppStore((s) => s.selectedTag);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);

  const visible = sortProjects(filterByTag(projects, selectedTag));

  return (
    <section className="td-section">
      <div className="td-section-head">
        <div>
          <p className="pol-eyebrow">세부 체크리스트 · 진행률</p>
          <h2 className="td-section-title">Projects</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
          className="pol-btn-primary pol-btn-sm td-btn-sm"
        >
          + 새 프로젝트
        </button>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          emoji="🗂️"
          message="아직 프로젝트가 없어요. 첫 프로젝트를 만들어 보세요!"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => {
                setEditing(project);
                setModalOpen(true);
              }}
            />
          ))}
        </div>
      )}
      <ProjectFormModal
        open={modalOpen}
        project={editing}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
