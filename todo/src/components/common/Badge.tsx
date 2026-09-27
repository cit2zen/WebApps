import type { DdayTone } from '../../utils/date';
import { ddayInfo } from '../../utils/date';
import { useToday } from '../../utils/useToday';

const toneClasses: Record<DdayTone, string> = {
  overdue: 'is-overdue',
  soon: 'is-soon',
  normal: 'is-normal',
};

export function Badge({ deadline }: { deadline?: string }) {
  const today = useToday();
  if (!deadline) return null;
  const { label, tone } = ddayInfo(deadline, today);
  return (
    <span className={`td-badge ${toneClasses[tone]}`}>{label}</span>
  );
}
