import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Event } from '../../types';
import { Modal } from '../common/Modal';

interface EventFormModalProps {
  open: boolean;
  event?: Event;
  defaultDate: string;
  onClose: () => void;
  onSaved?: (date: string) => void;
}

const inputClass = 'pol-input td-input-compact';

export function EventFormModal({
  open,
  event,
  defaultDate,
  onClose,
  onSaved,
}: EventFormModalProps) {
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
    onSaved?.(date);
    onClose();
  };

  return (
    <Modal open={open} title={event ? '일정 수정' : '새 일정'} onClose={onClose}>
      <form
        className="td-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="pol-field">
          <span className="pol-field-label">제목</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목"
            className={inputClass}
          />
        </label>
        <div className="td-form-row">
          <label className="pol-field">
            <span className="pol-field-label">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="pol-field">
            <span className="pol-field-label">시간 (선택)</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="pol-field">
          <span className="pol-field-label">메모</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택)"
            rows={2}
            className="pol-textarea td-input-compact"
          />
        </label>
        <div className="td-form-actions">
          <button type="button" onClick={onClose} className="pol-btn-ghost td-btn">
            취소
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !date}
            className="pol-btn-primary td-btn"
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
