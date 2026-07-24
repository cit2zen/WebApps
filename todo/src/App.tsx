import { AnimatePresence, motion } from 'motion/react';
import { EventsTab } from './components/events/EventsTab';
import { Header } from './components/layout/Header';
import { IntroCard } from './components/layout/IntroCard';
import { SummaryBar } from './components/layout/SummaryBar';
import { TabBar } from './components/layout/TabBar';
import { TagFilter } from './components/layout/TagFilter';
import { ProjectList } from './components/projects/ProjectList';
import { TaskList } from './components/tasks/TaskList';
import { useAppStore } from './store/useAppStore';
import type { TabId } from './types';

function TabContent({ tab }: { tab: TabId }) {
  if (tab === 'projects') return <ProjectList />;
  if (tab === 'tasks') return <TaskList />;
  return <EventsTab />;
}

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 pb-16">
      <Header />
      <IntroCard />
      <SummaryBar />
      <TagFilter />
      <TabBar />
      <AnimatePresence mode="wait">
        <motion.main
          key={activeTab}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <TabContent tab={activeTab} />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
