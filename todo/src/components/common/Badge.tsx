import type { DdayTone } from '../../utils/date';
import { ddayInfo } from '../../utils/date';

const toneClasses: Record<DdayTone, string> = {
  overdue: 'bg-rose-pastel-100 text-rose-pastel-500',
  soon: 'bg-amber-pastel-100 text-amber-pastel-600',
  normal: 'bg-ink/5 text-muted',
};

export function Badge({ deadline }: { deadline?: string }) {
  if (!deadline) return null;
  const { label, tone } = ddayInfo(deadline);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
