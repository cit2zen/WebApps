import { AnimatePresence, LayoutGroup } from 'motion/react';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { filterByTag, splitTasks } from '../../utils/selectors';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { QuickAdd } from './QuickAdd';
import { TaskItem } from './TaskItem';

export function TaskList() {
  const tasks = useAppStore((s) => s.tasks);
  const selectedTag = useAppStore((s) => s.selectedTag);
  const clearDoneTasks = useAppStore((s) => s.clearDoneTasks);
  const [doneCollapsed, setDoneCollapsed] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { pending, done } = splitTasks(filterByTag(tasks, selectedTag));
  const doneRecentFirst = [...done].reverse();

  return (
    <section className="td-section">
      <div className="td-section-head">
        <div>
          <p className="pol-eyebrow">빠른 한 줄 추가 · 마감일 · 태그</p>
          <h2 className="td-section-title">To-do</h2>
        </div>
      </div>
      <QuickAdd />
      {pending.length === 0 && done.length === 0 ? (
        <EmptyState emoji="🌿" message="할 일이 없어요. 위 입력창에 추가해 보세요!" />
      ) : (
        <LayoutGroup>
          <ul className="td-list">
            <AnimatePresence initial={false}>
              {pending.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </AnimatePresence>
          </ul>
          {done.length > 0 && (
            <div>
              <div className="td-done-head">
                <button
                  type="button"
                  onClick={() => setDoneCollapsed(!doneCollapsed)}
                  aria-expanded={!doneCollapsed}
                  className="td-text-btn is-strong"
                >
                  완료됨 ({done.length}) {doneCollapsed ? '▸' : '▾'}
                </button>
                {!doneCollapsed && (
                  <button
                    type="button"
                    onClick={() => setClearConfirmOpen(true)}
                    className="td-text-btn is-danger"
                  >
                    모두 비우기
                  </button>
                )}
              </div>
              {!doneCollapsed && (
                <ul className="td-list">
                  <AnimatePresence initial={false}>
                    {doneRecentFirst.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          )}
        </LayoutGroup>
      )}
      <ConfirmDialog
        open={clearConfirmOpen}
        message={`완료된 할 일 ${done.length}개를 모두 삭제할까요?`}
        onConfirm={() => {
          clearDoneTasks();
          setClearConfirmOpen(false);
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </section>
  );
}
