import { motion } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import type { TabId } from '../../types';

const TABS: { id: TabId; label: string; accent: string }[] = [
  { id: 'projects', label: '프로젝트', accent: 'tone-projects' },
  { id: 'tasks', label: '할 일', accent: 'tone-tasks' },
  { id: 'events', label: '일정', accent: 'tone-events' },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav className="pol-seg td-tabs" aria-label="보기 전환">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={activeTab === tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={activeTab === tab.id ? 'is-current' : undefined}
        >
          {activeTab === tab.id && (
            <motion.span
              layoutId="tab-pill"
              className="td-tab-pill"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className="td-tab-label">
            <span className={`td-dot ${tab.accent}`} aria-hidden="true" />
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
