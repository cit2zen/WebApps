import dayjs from 'dayjs';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useToday } from '../../utils/useToday';
import { eventDateSet } from '../../utils/selectors';

interface MiniCalendarProps {
  selected: string;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const navButtonClass = 'td-icon-btn';

export function MiniCalendar({ selected, onSelect }: MiniCalendarProps) {
  const events = useAppStore((s) => s.events);
  const [month, setMonth] = useState(() => dayjs(selected).startOf('month'));
  const today = useToday();

  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (!dayjs(selected).isSame(month, 'month')) {
      setMonth(dayjs(selected).startOf('month'));
    }
  }

  const dots = eventDateSet(events);
  const cells: (string | null)[] = [
    ...Array.from({ length: month.day() }, () => null),
    ...Array.from({ length: month.daysInMonth() }, (_, i) =>
      month.date(i + 1).format('YYYY-MM-DD'),
    ),
  ];

  const dayClass = (date: string): string => {
    if (date === selected) return 'is-selected';
    if (date === today) return 'is-today';
    return '';
  };

  return (
    <div className="pol-panel td-cal">
      <div className="td-cal-head">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => setMonth(month.subtract(1, 'month'))}
          className={navButtonClass}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <p className="td-cal-month">{month.format('YYYY년 M월')}</p>
          {(selected !== today || !month.isSame(dayjs(today), 'month')) && (
            <button
              type="button"
              onClick={() => {
                onSelect(today);
                setMonth(dayjs(today).startOf('month'));
              }}
              className="pol-chip td-chip"
            >
              오늘
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => setMonth(month.add(1, 'month'))}
          className={navButtonClass}
        >
          ›
        </button>
      </div>
      <div className="td-cal-grid">
        {WEEKDAYS.map((day, i) => (
          <span
            key={day}
            className={`td-cal-wd${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}`}
          >
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
              aria-pressed={date === selected}
              className={`td-cal-day ${dayClass(date)}`}
            >
              {dayjs(date).date()}
              {dots.has(date) && (
                <span className="td-cal-dot" aria-hidden="true" />
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
