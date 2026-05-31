import { describe, it, expect } from 'vitest';
import { withKeyedLock } from '@/lib/util/keyedLock';

describe('withKeyedLock', () => {
  it('같은 키 작업을 직렬화한다 (겹치지 않음)', async () => {
    const events: string[] = [];
    const task = (id: string) => async () => {
      events.push(`${id}-start`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`${id}-end`);
      return id;
    };
    const [a, b] = await Promise.all([
      withKeyedLock('k', task('A')),
      withKeyedLock('k', task('B')),
    ]);
    expect(a).toBe('A');
    expect(b).toBe('B');
    // 직렬화되었으면 A가 끝난 뒤 B가 시작
    expect(events).toEqual(['A-start', 'A-end', 'B-start', 'B-end']);
  });

  it('다른 키는 병렬로 진행된다', async () => {
    const events: string[] = [];
    const task = (id: string) => async () => {
      events.push(`${id}-start`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`${id}-end`);
    };
    await Promise.all([withKeyedLock('x', task('X')), withKeyedLock('y', task('Y'))]);
    // 둘 다 end 전에 둘 다 start (병렬)
    expect(events.slice(0, 2).sort()).toEqual(['X-start', 'Y-start']);
  });

  it('한 작업이 throw해도 다음 작업은 진행된다', async () => {
    await expect(withKeyedLock('z', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const ok = await withKeyedLock('z', async () => 'ok');
    expect(ok).toBe('ok');
  });
});
