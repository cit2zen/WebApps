import { useAppStore } from '../../store/useAppStore';
import { filterByTag, splitTasks } from '../../utils/selectors';
import { EmptyState } from '../common/EmptyState';
import { QuickAdd } from './QuickAdd';
import { TaskItem } from './TaskItem';

export function TaskList() {
  const tasks = useAppStore((s) => s.tasks);
  const selectedTag = useAppStore((s) => s.selectedTag);

  const { pending, done } = splitTasks(filterByTag(tasks, selectedTag));

  return (
    <section className="flex flex-col gap-3">
      <QuickAdd />
      {pending.length === 0 && done.length === 0 ? (
        <EmptyState emoji="🌿" message="할 일이 없어요. 위 입력창에 추가해 보세요!" />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {pending.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
          {done.length > 0 && (
            <div className="mt-2">
              <h3 className="mb-2 text-xs font-semibold text-muted">
                완료됨 ({done.length})
              </h3>
              <ul className="flex flex-col gap-2">
                {done.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
