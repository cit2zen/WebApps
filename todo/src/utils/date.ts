import dayjs from 'dayjs';
import 'dayjs/locale/ko';

dayjs.locale('ko');

export type DdayTone = 'overdue' | 'soon' | 'normal';

export interface DdayInfo {
  label: string;
  tone: DdayTone;
}

export function todayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function ddayInfo(deadline: string, today: string = todayStr()): DdayInfo {
  const d = dayjs(deadline).startOf('day').diff(dayjs(today).startOf('day'), 'day');
  if (d < 0) return { label: `${-d}일 지남`, tone: 'overdue' };
  if (d === 0) return { label: '오늘', tone: 'soon' };
  if (d <= 3) return { label: `D-${d}`, tone: 'soon' };
  return { label: `D-${d}`, tone: 'normal' };
}
