import pg from 'pg';
import type { DatabaseAdapter, ConnectionTestResult, ExecuteResult, TableInfo } from './adapter.js';

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | object;
}

export class PostgresAdapter implements DatabaseAdapter {
  public type: 'postgres' = 'postgres';
  private pool: pg.Pool;

  constructor(config: PostgresConfig | string) {
    if (typeof config === 'string') {
      this.pool = new pg.Pool({ connectionString: config });
    } else if (config.connectionString) {
      this.pool = new pg.Pool({ connectionString: config.connectionString, ssl: config.ssl });
    } else {
      this.pool = new pg.Pool({
        host: config.host || 'localhost',
        port: config.port || 5432,
        user: config.user || 'postgres',
        password: config.password || '',
        database: config.database || 'semar',
        ssl: config.ssl,
      });
    }
  }

  private convertPlaceholders(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const convertedSql = this.convertPlaceholders(sql);
    const client = await this.pool.connect();
    try {
      const res = await client.query(convertedSql, params);
      return res.rows as T[];
    } finally {
      client.release();
    }
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<ExecuteResult> {
    let convertedSql = this.convertPlaceholders(sql);
    const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
    if (isInsert && !/RETURNING/i.test(sql)) {
      convertedSql += ' RETURNING id';
    }

    const client = await this.pool.connect();
    try {
      const res = await client.query(convertedSql, params);
      const insertId = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : undefined;
      return {
        rowsAffected: res.rowCount || 0,
        insertId,
      };
    } finally {
      client.release();
    }
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txAdapter: DatabaseAdapter = {
        type: 'postgres',
        query: async <R = any>(sql: string, params: any[] = []) => {
          const res = await client.query(this.convertPlaceholders(sql), params);
          return res.rows as R[];
        },
        queryOne: async <R = any>(sql: string, params: any[] = []) => {
          const res = await client.query(this.convertPlaceholders(sql), params);
          return res.rows.length > 0 ? (res.rows[0] as R) : null;
        },
        execute: async (sql: string, params: any[] = []) => {
          let cSql = this.convertPlaceholders(sql);
          if (/^\s*INSERT\s+INTO/i.test(sql) && !/RETURNING/i.test(sql)) {
            cSql += ' RETURNING id';
          }
          const res = await client.query(cSql, params);
          return {
            rowsAffected: res.rowCount || 0,
            insertId: res.rows?.[0]?.id,
          };
        },
        transaction: () => Promise.reject(new Error('Nested transactions not supported')),
        testConnection: () => this.testConnection(),
        getTables: () => this.getTables(),
        createNodeTable: (nodeId: string) => this.createNodeTable(nodeId),
        dropNodeTable: (nodeId: string) => this.dropNodeTable(nodeId),
        getNodeTableStats: (nodeId: string) => this.getNodeTableStats(nodeId),
        close: async () => {},
      };

      const result = await fn(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
        type: 'postgres',
        latencyMs: Date.now() - start,
        version: res[0]?.version?.split(' ')?.[1] || 'PostgreSQL',
        database: res[0]?.current_database || 'unknown',
      };
    } catch (err: any) {
      return {
        success: false,
        type: 'postgres',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const sql = `
      SELECT 
        table_name as name,
        table_type as type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name ASC;
    `;
    const rows = await this.query<{ name: string; type: string }>(sql);
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

    const sql = `
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
    `;

    await this.query(sql);
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
    await this.pool.end();
  }
}
