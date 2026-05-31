import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, clearRateLimit } from '@/lib/util/rateLimit';

beforeEach(() => clearRateLimit());

describe('rateLimit', () => {
  it('윈도우 내 max회까지 허용, 초과는 거부', () => {
    expect(rateLimit('k', 2, 1000, 0)).toBe(true);
    expect(rateLimit('k', 2, 1000, 100)).toBe(true);
    expect(rateLimit('k', 2, 1000, 200)).toBe(false); // 3번째 거부
  });
  it('윈도우가 지나면 다시 허용', () => {
    expect(rateLimit('k', 1, 1000, 0)).toBe(true);
    expect(rateLimit('k', 1, 1000, 500)).toBe(false);
    expect(rateLimit('k', 1, 1000, 1500)).toBe(true); // 윈도우 경과
  });
  it('키가 다르면 독립적', () => {
    expect(rateLimit('a', 1, 1000, 0)).toBe(true);
    expect(rateLimit('b', 1, 1000, 0)).toBe(true);
  });
});
