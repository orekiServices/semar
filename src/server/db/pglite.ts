import { PGlite } from '@electric-sql/pglite';
import type { DatabaseAdapter, ConnectionTestResult, ExecuteResult, TableInfo } from './adapter.js';

/**
 * v2.2 — PGlite adapter: real PostgreSQL (WASM, in-process) for tests and
 * zero-config local development. Production uses managed Postgres.
 *
 * Select with USE_PGLITE=1 (tests set this automatically via npm test).
 */
// Tables whose primary key is NOT an `id` column — appending `RETURNING id`
// to INSERTs against them would fail with 42703 (undefined column).
const NO_ID_TABLES = new Set(['nodes', 'admin_users', 'system_config', 'youtube_cache']);

function wantsReturningId(sql: string): boolean {
  if (!/^\s*INSERT\s+INTO/i.test(sql) || /RETURNING/i.test(sql)) return false;
  const m = sql.match(/^\s*INSERT\s+INTO\s+["`]?([A-Za-z0-9_]+)/i);
  if (!m) return false;
  return !NO_ID_TABLES.has(m[1].toLowerCase());
}

export class PgliteAdapter implements DatabaseAdapter {
  public type: 'pglite' = 'pglite';
  private db: PGlite;
  private ready: Promise<void>;

  constructor(dataDir?: string) {
    this.db = dataDir ? new PGlite(dataDir) : new PGlite();
    this.ready = this.db.waitReady.then(() => undefined);
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private convertPlaceholders(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  /** PGlite query() handles single statements; route multi-statement DDL to exec(). */
  private isMultiStatement(sql: string, params: any[]): boolean {
    if (params.length > 0) return false;
    const stripped = sql.replace(/--.*$/gm, '').trim().replace(/;+$/g, '').trim();
    return stripped.includes(';');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureReady();
    if (this.isMultiStatement(sql, params)) {
      await this.db.exec(sql);
      return [];
    }
    const res = await this.db.query<T>(this.convertPlaceholders(sql), params);
    return res.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<ExecuteResult> {
    await this.ensureReady();
    let convertedSql = this.convertPlaceholders(sql);
    if (wantsReturningId(sql)) {
      convertedSql += ' RETURNING id';
    }
    const res = await this.db.query(convertedSql, params);
    const insertId = (res.rows?.[0] as any)?.id;
    return {
      rowsAffected: res.affectedRows ?? 0,
      insertId,
    };
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    await this.ensureReady();
    await this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      await this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        await this.db.exec('ROLLBACK');
      } catch {}
      throw err;
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const res = await this.query<{ version: string; current_database: string }>(
        'SELECT version(), current_database()'
      );
      return {
        success: true,
        type: 'pglite',
        latencyMs: Date.now() - start,
        version: 'PGlite ' + (res[0]?.version?.split(' ')?.[1] || ''),
        database: res[0]?.current_database || 'memory',
      };
    } catch (err: any) {
      return {
        success: false,
        type: 'pglite',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const rows = await this.query<{ name: string; type: string }>(
      `SELECT table_name as name, table_type as type
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name ASC`
    );
    const tables: TableInfo[] = [];
    for (const row of rows) {
      const countRes = await this.query<{ count: string }>(`SELECT COUNT(*) as count FROM "${row.name}"`);
      tables.push({
        name: row.name,
        type: row.type,
        rowCount: parseInt(countRes[0]?.count || '0', 10),
      });
    }
    return tables;
  }

  async createNodeTable(nodeId: string): Promise<void> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    await this.query(`
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        youtube_video_id VARCHAR(64),
        duration INTEGER DEFAULT 0,
        plain_lyrics TEXT,
        synced_lyrics TEXT,
        ttml_lyrics TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        is_explicit BOOLEAN DEFAULT FALSE,
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_${tableName}_title" ON "${tableName}" ("title");
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_artist" ON "${tableName}" ("artist");
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_yt" ON "${tableName}" ("youtube_video_id");
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_meta_gin" ON "${tableName}" USING gin ("metadata");
    `);
  }

  async dropNodeTable(nodeId: string): Promise<void> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    await this.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
  }

  async getNodeTableStats(nodeId: string): Promise<{ rowCount: number; sizeBytes?: number }> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    try {
      const countRes = await this.query<{ count: string; size: string }>(`
        SELECT
          COUNT(*) as count,
          pg_total_relation_size('"${tableName}"') as size
        FROM "${tableName}"
      `);
      return {
        rowCount: parseInt(countRes[0]?.count || '0', 10),
        sizeBytes: parseInt(countRes[0]?.size || '0', 10),
      };
    } catch {
      return { rowCount: 0, sizeBytes: 0 };
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
