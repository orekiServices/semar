export type DatabaseType = 'postgres' | 'mysql' | 'sqlite';

export interface TableInfo {
  name: string;
  rowCount: number;
  type: string;
  sizeBytes?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  type: DatabaseType;
  latencyMs: number;
  version?: string;
  database?: string;
  error?: string;
}

export interface ExecuteResult {
  rowsAffected: number;
  insertId?: number | string;
}

export interface DatabaseAdapter {
  type: DatabaseType;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<ExecuteResult>;
  transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;
  testConnection(): Promise<ConnectionTestResult>;
  getTables(): Promise<TableInfo[]>;
  createNodeTable(nodeId: string): Promise<void>;
  dropNodeTable(nodeId: string): Promise<void>;
  getNodeTableStats(nodeId: string): Promise<{ rowCount: number; sizeBytes?: number }>;
  close(): Promise<void>;
}
