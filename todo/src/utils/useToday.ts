import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { todayStr } from './date';

/** 자정 넘김·탭 복귀 시 자동 갱신되는 오늘 날짜(YYYY-MM-DD). */
export function useToday(): string {
  const [today, setToday] = useState(todayStr);

  useEffect(() => {
    let timer: number;
    const refresh = () => setToday((prev) => (prev === todayStr() ? prev : todayStr()));
    const schedule = () => {
      const untilMidnight = dayjs().add(1, 'day').startOf('day').diff(dayjs());
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, untilMidnight + 1000);
    };
    schedule();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return today;
}
