import mysql from 'mysql2/promise';
import type { DatabaseAdapter, ConnectionTestResult, ExecuteResult, TableInfo } from './adapter.js';

export interface MysqlConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: any;
}

export class MysqlAdapter implements DatabaseAdapter {
  public type: 'mysql' = 'mysql';
  private pool: mysql.Pool;

  constructor(config: MysqlConfig | string) {
    if (typeof config === 'string') {
      this.pool = mysql.createPool(config);
    } else if (config.connectionString) {
      this.pool = mysql.createPool(config.connectionString);
    } else {
      this.pool = mysql.createPool({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.user || 'root',
        password: config.password || '',
        database: config.database || 'semar',
        waitForConnections: true,
        connectionLimit: 10,
        ssl: config.ssl,
      });
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<ExecuteResult> {
    const [result] = await this.pool.execute<mysql.ResultSetHeader>(sql, params);
    return {
      rowsAffected: result.affectedRows || 0,
      insertId: result.insertId,
    };
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const txAdapter: DatabaseAdapter = {
        type: 'mysql',
        query: async <R = any>(sql: string, params: any[] = []) => {
          const [rows] = await connection.execute(sql, params);
          return rows as R[];
        },
        queryOne: async <R = any>(sql: string, params: any[] = []) => {
          const [rows] = await connection.execute(sql, params);
          const r = rows as R[];
          return r.length > 0 ? r[0] : null;
        },
        execute: async (sql: string, params: any[] = []) => {
          const [res] = await connection.execute<mysql.ResultSetHeader>(sql, params);
          return {
            rowsAffected: res.affectedRows || 0,
            insertId: res.insertId,
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

      const res = await fn(txAdapter);
      await connection.commit();
      return res;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const [rows] = await this.pool.query<any[]>('SELECT VERSION() as version, DATABASE() as db');
      return {
        success: true,
        type: 'mysql',
        latencyMs: Date.now() - start,
        version: rows[0]?.version || 'MySQL',
        database: rows[0]?.db || 'unknown',
      };
    } catch (err: any) {
      return {
        success: false,
        type: 'mysql',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const [rows] = await this.pool.query<any[]>(`
      SELECT table_name AS name, table_type AS type, table_rows AS rowCount, data_length AS sizeBytes
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);
    return rows.map(r => ({
      name: r.name,
      type: r.type,
      rowCount: parseInt(r.rowCount || '0', 10),
      sizeBytes: parseInt(r.sizeBytes || '0', 10),
    }));
  }

  async createNodeTable(nodeId: string): Promise<void> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    const sql = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`artist\` VARCHAR(255) NOT NULL,
        \`album\` VARCHAR(255),
        \`youtube_video_id\` VARCHAR(64),
        \`duration\` INT DEFAULT 0,
        \`plain_lyrics\` MEDIUMTEXT,
        \`synced_lyrics\` MEDIUMTEXT,
        \`ttml_lyrics\` MEDIUMTEXT,
        \`metadata\` JSON,
        \`is_explicit\` BOOLEAN DEFAULT FALSE,
        \`views_count\` INT DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_title\` (\`title\`),
        INDEX \`idx_artist\` (\`artist\`),
        INDEX \`idx_yt\` (\`youtube_video_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await this.pool.query(sql);
  }

  async dropNodeTable(nodeId: string): Promise<void> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    await this.pool.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
  }

  async getNodeTableStats(nodeId: string): Promise<{ rowCount: number; sizeBytes?: number }> {
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    try {
      const [rows] = await this.pool.query<any[]>(`
        SELECT COUNT(*) as count FROM \`${tableName}\`
      `);
      return {
        rowCount: parseInt(rows[0]?.count || '0', 10),
        sizeBytes: 0,
      };
    } catch {
      return { rowCount: 0, sizeBytes: 0 };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
