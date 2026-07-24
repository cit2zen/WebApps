import { describe, expect, it } from 'vitest';
import { ddayInfo, todayStr } from './date';

describe('ddayInfo', () => {
  const today = '2026-07-24';

  it('지난 마감은 "n일 지남" + overdue', () => {
    expect(ddayInfo('2026-07-21', today)).toEqual({ label: '3일 지남', tone: 'overdue' });
    expect(ddayInfo('2026-07-23', today)).toEqual({ label: '1일 지남', tone: 'overdue' });
  });

  it('오늘 마감은 "오늘" + soon', () => {
    expect(ddayInfo('2026-07-24', today)).toEqual({ label: '오늘', tone: 'soon' });
  });

  it('3일 이내는 D-n + soon', () => {
    expect(ddayInfo('2026-07-25', today)).toEqual({ label: 'D-1', tone: 'soon' });
    expect(ddayInfo('2026-07-27', today)).toEqual({ label: 'D-3', tone: 'soon' });
  });

  it('4일 이상은 D-n + normal', () => {
    expect(ddayInfo('2026-07-28', today)).toEqual({ label: 'D-4', tone: 'normal' });
    expect(ddayInfo('2026-12-31', today)).toEqual({ label: 'D-160', tone: 'normal' });
  });
});

describe('todayStr', () => {
  it('YYYY-MM-DD 형식', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
