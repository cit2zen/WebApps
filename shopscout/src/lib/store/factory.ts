import type { Store } from './types';
import { MemoryStore, SqliteStore } from './sqliteStore';

let cached: Promise<Store> | null = null;

/**
 * 프로세스 단일 Store를 반환한다.
 * - SHOPSCOUT_STORE=memory 또는 sqlite 사용 불가 시 인메모리로 우아하게 degrade.
 * - 그 외에는 SQLite 영속화.
 */
export function getStore(): Promise<Store> {
  if (!cached) {
    cached = (async () => {
      if (process.env.SHOPSCOUT_STORE === 'memory') return new MemoryStore();
      try {
        return await SqliteStore.open(process.env.SHOPSCOUT_DB ?? 'shopscout.db');
      } catch (e) {
        console.warn(
          '[store] SQLite 초기화 실패 → 인메모리로 degrade(재시작 시 대화 유실):',
          (e as Error).message,
        );
        return new MemoryStore();
      }
    })();
  }
  return cached;
}
