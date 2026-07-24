import dayjs from 'dayjs';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Event } from '../../types';
import { eventsOn } from '../../utils/selectors';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { EventFormModal } from './EventFormModal';

export function EventList({ date }: { date: string }) {
  const events = useAppStore((s) => s.events);
  const deleteEvent = useAppStore((s) => s.deleteEvent);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>(undefined);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const list = eventsOn(events, date);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{dayjs(date).format('M월 D일 (ddd)')} 일정</h3>
        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
          className="rounded-xl bg-peach-400 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-peach-500"
        >
          + 일정 추가
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState emoji="🍑" message="이 날엔 일정이 없어요." />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm"
            >
              <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold text-peach-500">
                {event.time ?? '종일'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{event.title}</p>
                {event.memo && <p className="mt-0.5 text-xs text-muted">{event.memo}</p>}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(event);
                    setModalOpen(true);
                  }}
                  className="text-muted hover:text-ink"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(event.id)}
                  className="text-muted hover:text-rose-pastel-500"
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
