import type { DatabaseAdapter, ConnectionTestResult, TableInfo } from './adapter.js';
import { PostgresAdapter, type PostgresConfig } from './postgres.js';
import { MysqlAdapter, type MysqlConfig } from './mysql.js';
import { PgliteAdapter } from './pglite.js';
import { runMigrations } from './schema.js';
import { seedDatabase } from './seed.js';

let currentAdapter: DatabaseAdapter | null = null;
let activeConfig: { type: 'postgres' | 'mysql' | 'pglite'; url?: string; config?: any } = {
  type: 'postgres',
};

export const NO_DATABASE_ERROR =
  'No database configured. Set POSTGRES_URL (e.g. Neon, Supabase, Vercel Postgres) or MYSQL_URL. ' +
  'For local development/tests, set USE_PGLITE=1 to use embedded PostgreSQL.';

/**
 * v2.2 — Postgres-first resolution (SQLite removed: it cannot work on
 * serverless hosts like Vercel and its native binding crashes functions).
 */
export function getDb(): DatabaseAdapter {
  if (!currentAdapter) {
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    const mysqlUrl = process.env.MYSQL_URL;

    if (postgresUrl && (postgresUrl.startsWith('postgres://') || postgresUrl.startsWith('postgresql://'))) {
      currentAdapter = new PostgresAdapter(postgresUrl);
      activeConfig = { type: 'postgres', url: postgresUrl };
    } else if (mysqlUrl && mysqlUrl.startsWith('mysql://')) {
      currentAdapter = new MysqlAdapter(mysqlUrl);
      activeConfig = { type: 'mysql', url: mysqlUrl };
    } else if (process.env.USE_PGLITE === '1' || process.env.NODE_ENV === 'test') {
      currentAdapter = new PgliteAdapter(process.env.PGLITE_DIR || undefined);
      activeConfig = { type: 'pglite' };
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Semar] USE_PGLITE=1: running on embedded in-memory PostgreSQL (data is ephemeral unless PGLITE_DIR is set).');
      }
    } else {
      throw new Error(NO_DATABASE_ERROR);
    }
  }
  return currentAdapter;
}

export function getActiveDbConfig() {
  return activeConfig;
}

/** Test helper: inject a pre-built adapter (used to share one PGlite across suites). */
export function _setDbForTests(adapter: DatabaseAdapter): void {
  currentAdapter = adapter;
  activeConfig = { type: adapter.type as 'postgres' | 'mysql' | 'pglite' };
}

export async function switchDatabase(
  type: 'postgres' | 'mysql' | 'pglite',
  configOrUrl?: string | PostgresConfig | MysqlConfig
): Promise<ConnectionTestResult> {
  let newAdapter: DatabaseAdapter;

  if (type === 'postgres') {
    newAdapter = new PostgresAdapter((configOrUrl as PostgresConfig | string) || '');
  } else if (type === 'mysql') {
    newAdapter = new MysqlAdapter((configOrUrl as MysqlConfig | string) || '');
  } else {
    newAdapter = new PgliteAdapter(typeof configOrUrl === 'string' && configOrUrl ? configOrUrl : undefined);
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
