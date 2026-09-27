import dayjs from 'dayjs';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Event } from '../../types';
import { eventsOn } from '../../utils/selectors';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { EventFormModal } from './EventFormModal';

interface EventListProps {
  date: string;
  onSelectDate?: (date: string) => void;
}

export function EventList({ date, onSelectDate }: EventListProps) {
  const events = useAppStore((s) => s.events);
  const deleteEvent = useAppStore((s) => s.deleteEvent);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>(undefined);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const list = eventsOn(events, date);

  return (
    <div className="td-section">
      <div className="td-list-head">
        <h3 className="td-list-title">{dayjs(date).format('M월 D일 (ddd)')} 일정</h3>
        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
          className="pol-btn-primary pol-btn-sm td-btn-sm"
        >
          + 일정 추가
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState emoji="📅" message="이 날엔 일정이 없어요." />
      ) : (
        <ul className="td-list">
          {list.map((event) => (
            <li key={event.id} className="td-item td-event">
              {/* 시간(숫자)만 모노, 종일(한글)은 라벨 폰트 */}
              <span className={`td-event-time ${event.time ? 'is-mono' : 'is-allday'}`}>
                {event.time ?? '종일'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="td-event-title">{event.title}</p>
                {event.memo && <p className="td-memo mt-0.5">{event.memo}</p>}
              </div>
              <div className="td-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(event);
                    setModalOpen(true);
                  }}
                  className="td-text-btn"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(event.id)}
                  className="td-text-btn is-danger"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <EventFormModal
        open={modalOpen}
        event={editing}
        defaultDate={date}
        onClose={() => setModalOpen(false)}
        onSaved={onSelectDate}
      />
      <ConfirmDialog
        open={confirmId !== null}
        message="이 일정을 삭제할까요?"
        onConfirm={() => {
          if (confirmId) deleteEvent(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
