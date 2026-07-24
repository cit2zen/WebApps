import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Event } from '../../types';
import { Modal } from '../common/Modal';

interface EventFormModalProps {
  open: boolean;
  event?: Event;
  defaultDate: string;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-xl bg-cream px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-peach-200';

export function EventFormModal({ open, event, defaultDate, onClose }: EventFormModalProps) {
  const addEvent = useAppStore((s) => s.addEvent);
  const updateEvent = useAppStore((s) => s.updateEvent);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(event?.title ?? '');
      setDate(event?.date ?? defaultDate);
      setTime(event?.time ?? '');
      setMemo(event?.memo ?? '');
    }
  }, [open, event, defaultDate]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    const input = {
      title: trimmed,
      date,
      time: time || undefined,
      memo: memo.trim() || undefined,
    };
    if (event) updateEvent(event.id, input);
    else addEvent(input);
    onClose();
  };

  return (
    <Modal open={open} title={event ? '일정 수정' : '새 일정'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="일정 제목"
          className={inputClass}
        />
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            날짜
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            시간 (선택)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={2}
          className={inputClass}
        />
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-muted hover:bg-cream"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || !date}
            className="rounded-xl bg-peach-400 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-peach-500 disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}
