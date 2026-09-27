import dayjs from 'dayjs';
import { useToday } from '../../utils/useToday';

export function PageHero() {
  const today = useToday();

  return (
    <div className="td-hero">
      <p className="pol-eyebrow">{dayjs(today).format('M월 D일 dddd')}</p>
      <h1 className="td-hero-title">
        todo<span>.</span>
      </h1>
      <p className="td-hero-lead">프로젝트 · 할 일 · 일정을 한곳에서</p>
    </div>
  );
}
