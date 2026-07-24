import { motion } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import type { TabId } from '../../types';

const TABS: { id: TabId; label: string; accent: string }[] = [
  { id: 'projects', label: '프로젝트', accent: 'text-lavender-500' },
  { id: 'tasks', label: '할 일', accent: 'text-mint-500' },
  { id: 'events', label: '일정', accent: 'text-peach-500' },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav className="flex rounded-2xl bg-white p-1 shadow-sm">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={`relative flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            activeTab === tab.id ? tab.accent : 'text-muted'
          }`}
        >
          {activeTab === tab.id && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-xl bg-cream"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
