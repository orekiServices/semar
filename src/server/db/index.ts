import type { DatabaseAdapter, ConnectionTestResult, TableInfo } from './adapter.js';
import { PostgresAdapter, type PostgresConfig } from './postgres.js';
import { MysqlAdapter, type MysqlConfig } from './mysql.js';
import { SqliteAdapter } from './sqlite.js';
import { runMigrations } from './schema.js';
import { seedDatabase } from './seed.js';

let currentAdapter: DatabaseAdapter | null = null;
let activeConfig: { type: 'postgres' | 'mysql' | 'sqlite'; url?: string; config?: any } = {
  type: 'sqlite',
  url: './data/semar.db',
};

export function getDb(): DatabaseAdapter {
  if (!currentAdapter) {
    // Determine from env vars or fallback to SQLite
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    const mysqlUrl = process.env.MYSQL_URL;

    if (postgresUrl && (postgresUrl.startsWith('postgres://') || postgresUrl.startsWith('postgresql://'))) {
      currentAdapter = new PostgresAdapter(postgresUrl);
      activeConfig = { type: 'postgres', url: postgresUrl };
    } else if (mysqlUrl && mysqlUrl.startsWith('mysql://')) {
      currentAdapter = new MysqlAdapter(mysqlUrl);
      activeConfig = { type: 'mysql', url: mysqlUrl };
    } else {
      const sqlitePath = process.env.SQLITE_PATH || './data/semar.db';
      currentAdapter = new SqliteAdapter(sqlitePath);
      activeConfig = { type: 'sqlite', url: sqlitePath };
    }
  }
  return currentAdapter;
}

export function getActiveDbConfig() {
  return activeConfig;
}

export async function switchDatabase(
  type: 'postgres' | 'mysql' | 'sqlite',
  configOrUrl: string | PostgresConfig | MysqlConfig
): Promise<ConnectionTestResult> {
  let newAdapter: DatabaseAdapter;

  if (type === 'postgres') {
    newAdapter = new PostgresAdapter(configOrUrl as PostgresConfig | string);
  } else if (type === 'mysql') {
    newAdapter = new MysqlAdapter(configOrUrl as MysqlConfig | string);
  } else {
    newAdapter = new SqliteAdapter(typeof configOrUrl === 'string' ? configOrUrl : './data/semar.db');
  }

  const testRes = await newAdapter.testConnection();
  if (!testRes.success) {
    await newAdapter.close();
    return testRes;
  }

  // Close existing adapter
  if (currentAdapter) {
    try {
      await currentAdapter.close();
    } catch {
      // ignore
    }
  }

  currentAdapter = newAdapter;
  activeConfig = {
    type,
    url: typeof configOrUrl === 'string' ? configOrUrl : undefined,
    config: typeof configOrUrl !== 'string' ? configOrUrl : undefined,
  };

  // Run migrations & seed on new database
  await runMigrations(currentAdapter);
  await seedDatabase(currentAdapter);

  return testRes;
}

export async function initDatabase(seed: boolean = true): Promise<DatabaseAdapter> {
  const db = getDb();
  await runMigrations(db);
  if (seed) {
    await seedDatabase(db);
  }
  return db;
}

export { DatabaseAdapter, ConnectionTestResult, TableInfo };
