import dayjs from 'dayjs';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { todayStr } from '../../utils/date';
import { eventDateSet } from '../../utils/selectors';

interface MiniCalendarProps {
  selected: string;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const navButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-cream hover:text-ink';

export function MiniCalendar({ selected, onSelect }: MiniCalendarProps) {
  const events = useAppStore((s) => s.events);
  const [month, setMonth] = useState(() => dayjs(selected).startOf('month'));

  const dots = eventDateSet(events);
  const today = todayStr();
  const cells: (string | null)[] = [
    ...Array.from({ length: month.day() }, () => null),
    ...Array.from({ length: month.daysInMonth() }, (_, i) =>
      month.date(i + 1).format('YYYY-MM-DD'),
    ),
  ];

  const dayClass = (date: string): string => {
    if (date === selected) return 'bg-peach-400 font-semibold text-white';
    if (date === today) return 'bg-peach-100 font-semibold text-peach-500';
    return 'hover:bg-cream';
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => setMonth(month.subtract(1, 'month'))}
          className={navButtonClass}
        >
          ‹
        </button>
        <p className="text-sm font-bold">{month.format('YYYY년 M월')}</p>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => setMonth(month.add(1, 'month'))}
          className={navButtonClass}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-xs text-muted">
            {day}
          </span>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <span key={`empty-${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${dayClass(date)}`}
            >
              {dayjs(date).date()}
              {dots.has(date) && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    date === selected ? 'bg-white' : 'bg-peach-400'
                  }`}
                />
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
