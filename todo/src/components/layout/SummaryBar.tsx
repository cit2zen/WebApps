import { useAppStore } from '../../store/useAppStore';
import { todayStr } from '../../utils/date';
import { summarize } from '../../utils/selectors';

export function SummaryBar() {
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const { incompleteCount, dueTodayCount, avgProgress } = summarize(
    projects,
    tasks,
    todayStr(),
  );

  const items = [
    { label: '미완료 할 일', value: `${incompleteCount}개` },
    { label: '오늘 마감', value: `${dueTodayCount}개` },
    { label: '평균 달성률', value: `${avgProgress}%` },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl bg-white px-3 py-3 text-center shadow-sm"
        >
          <p className="text-lg font-bold">{item.value}</p>
          <p className="text-xs text-muted">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
