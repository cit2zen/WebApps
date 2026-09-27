import { useAppStore } from '../../store/useAppStore';
import { useToday } from '../../utils/useToday';
import { summarize } from '../../utils/selectors';

export function SummaryBar() {
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const today = useToday();
  const { incompleteCount, dueTodayCount, avgProgress } = summarize(
    projects,
    tasks,
    today,
  );

  const items = [
    { label: '미완료 할 일', num: incompleteCount, unit: '개', valueClass: '' },
    {
      label: '오늘 마감',
      num: dueTodayCount,
      unit: '개',
      valueClass: dueTodayCount > 0 ? 'is-alert' : '',
    },
    { label: '평균 달성률', num: avgProgress, unit: '%', valueClass: 'is-gold' },
  ];

  return (
    <div className="td-stats">
      {items.map((item) => (
        <div key={item.label} className="pol-tile td-stat">
          <p className={`td-stat-value ${item.valueClass}`}>
            <span className="td-stat-num">{item.num}</span>
            <span className="td-stat-unit">{item.unit}</span>
          </p>
          <p className="td-stat-label">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
