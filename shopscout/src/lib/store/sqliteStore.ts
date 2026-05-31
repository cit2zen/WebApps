import type { Conversation, Store } from './types';

/**
 * better-sqlite3 기반 영속화. conversations(id, data JSON) 단일 테이블.
 * 서버 전용 — 동적 import로 클라이언트 번들 오염 방지.
 */
export class SqliteStore implements Store {
  private db: any;

  private constructor(db: any) {
    this.db = db;
  }

  static async open(path = 'shopscout.db'): Promise<SqliteStore> {
    // 빌드 정적분석이 better-sqlite3(optionalDependency)를 해석하지 못하도록 Function 경유로 숨긴다.
    // SHOPSCOUT_STORE=memory(서버 기본)에선 이 경로에 도달하지 않으므로 미설치여도 빌드/런타임 무해.
    const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<{ default: new (p: string) => any }>;
    const mod = await dynImport('better-sqlite3');
    const Database = mod.default;
    const db: any = new Database(path);
    db.exec('CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
    return new SqliteStore(db);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const row = this.db.prepare('SELECT data FROM conversations WHERE id = ?').get(id);
    return row ? (JSON.parse(row.data) as Conversation) : null;
  }

  async saveConversation(c: Conversation): Promise<void> {
    this.db
      .prepare('INSERT OR REPLACE INTO conversations (id, data) VALUES (?, ?)')
      .run(c.id, JSON.stringify(c));
  }
}

/** 테스트/개발용 인메모리 Store. */
export class MemoryStore implements Store {
  private map = new Map<string, Conversation>();
  async getConversation(id: string): Promise<Conversation | null> {
    return this.map.get(id) ?? null;
  }
  async saveConversation(c: Conversation): Promise<void> {
    this.map.set(c.id, c);
  }
}
