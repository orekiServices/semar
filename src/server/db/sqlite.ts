import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { DatabaseAdapter, ConnectionTestResult, ExecuteResult, TableInfo } from './adapter.js';

export class SqliteAdapter implements DatabaseAdapter {
  public type: 'sqlite' = 'sqlite';
  private db: Database.Database;
  private dbPath: string;

  constructor(filePath: string = './data/semar.db') {
    this.dbPath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const trimmed = sql.trim();
      // If it contains multiple statements or is a DDL script with no params
      if (params.length === 0 && (trimmed.includes(';') || /^\s*(CREATE|DROP|ALTER|BEGIN|COMMIT)/i.test(trimmed))) {
        this.db.exec(trimmed);
        return [] as T[];
      }
      const stmt = this.db.prepare(trimmed);
      const rows = stmt.all(...params);
      return rows as T[];
    } catch (err: any) {
      throw new Error(`SQLite Query Error: ${err.message} (SQL: ${sql})`);
    }
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql.trim());
      const row = stmt.get(...params);
      return (row as T) || null;
    } catch (err: any) {
      throw new Error(`SQLite QueryOne Error: ${err.message} (SQL: ${sql})`);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<ExecuteResult> {
    try {
      const trimmed = sql.trim();
      if (params.length === 0 && (trimmed.includes(';') || /^\s*(CREATE|DROP|ALTER)/i.test(trimmed))) {
        this.db.exec(trimmed);
        return { rowsAffected: 0 };
      }
      const stmt = this.db.prepare(trimmed);
      const info = stmt.run(...params);
      return {
        rowsAffected: info.changes,
        insertId: Number(info.lastInsertRowid),
      };
    } catch (err: any) {
      throw new Error(`SQLite Execute Error: ${err.message} (SQL: ${sql})`);
    }
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const runInTx = this.db.transaction((txFn: () => any) => txFn());
    return runInTx(async () => {
      return await fn(this);
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const row = this.db.prepare('SELECT sqlite_version() as version').get() as { version: string };
      return {
        success: true,
        type: 'sqlite',
        latencyMs: Date.now() - start,
        version: row?.version || 'SQLite 3',
        database: this.dbPath,
      };
    } catch (err: any) {
      return {
        success: false,
        type: 'sqlite',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const rows = this.db.prepare(`
      SELECT name, type 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all() as Array<{ name: string; type: string }>;

    const tables: TableInfo[] = [];
    for (const row of rows) {
      const countRes = this.db.prepare(`SELECT COUNT(*) as count FROM "${row.name}"`).get() as { count: number };
      tables.push({
        name: row.name,
        type: row.type,
        rowCount: countRes?.count || 0,
      });
    }
    return tables;
  }

  async createNodeTable(nodeId: string): Promise<void> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        youtube_video_id TEXT,
        duration INTEGER DEFAULT 0,
        plain_lyrics TEXT,
        synced_lyrics TEXT,
        ttml_lyrics TEXT,
        metadata TEXT DEFAULT '{}',
        is_explicit INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "idx_${tableName}_title" ON "${tableName}" ("title");
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_artist" ON "${tableName}" ("artist");
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_yt" ON "${tableName}" ("youtube_video_id");
    `);
  }

  async dropNodeTable(nodeId: string): Promise<void> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    this.db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  }

  async getNodeTableStats(nodeId: string): Promise<{ rowCount: number; sizeBytes?: number }> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    try {
      const countRes = this.db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
      return {
        rowCount: countRes?.count || 0,
        sizeBytes: 0,
      };
    } catch {
      return { rowCount: 0, sizeBytes: 0 };
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
