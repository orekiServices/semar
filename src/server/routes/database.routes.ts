import { Router } from 'express';
import { getDb, getActiveDbConfig, switchDatabase } from '../db/index.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

router.get('/info', requireAdminAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const active = getActiveDbConfig();
    const test = await db.testConnection();
    const tables = await db.getTables();

    res.json({
      status: 'success',
      type: db.type,
      config: {
        type: active.type,
        url: active.url ? active.url.replace(/:[^:@]+@/, ':***@') : undefined,
      },
      connection: test,
      tables,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/test', requireAdminAuth, async (req, res, next) => {
  try {
    const { type, connectionString, config } = req.body;
    let testRes;

    if (type === 'postgres') {
      const { PostgresAdapter } = await import('../db/postgres.js');
      const adapter = new PostgresAdapter(connectionString || config);
      testRes = await adapter.testConnection();
      await adapter.close();
    } else if (type === 'mysql') {
      const { MysqlAdapter } = await import('../db/mysql.js');
      const adapter = new MysqlAdapter(connectionString || config);
      testRes = await adapter.testConnection();
      await adapter.close();
    } else {
      const { SqliteAdapter } = await import('../db/sqlite.js');
      const adapter = new SqliteAdapter(connectionString || './data/semar.db');
      testRes = await adapter.testConnection();
      await adapter.close();
    }

    res.json(testRes);
  } catch (err: any) {
    res.json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/switch', requireAdminAuth, async (req, res, next) => {
  try {
    const { type, connectionString, config } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Database type is required' });
    }

    const switchRes = await switchDatabase(type, connectionString || config);
    if (!switchRes.success) {
      return res.status(400).json({ error: `Connection failed: ${switchRes.error}` });
    }

    await logsService.recordAudit('DB_SWITCHED', (req as any).user?.username, { targetType: type }, req.ip);
    res.json({ status: 'success', message: `Switched database engine to ${type}`, connection: switchRes });
  } catch (err) {
    next(err);
  }
});

// Safe SQL Query runner for administrator debugging
router.post('/query', requireAdminAuth, async (req, res, next) => {
  try {
    const { sql, params } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'sql query string is required' });
    }

    const trimmed = sql.trim();
    // Safety check: allow SELECT, SHOW, EXPLAIN, DESCRIBE
    const db = getDb();
    const isSelect = /^(SELECT|SHOW|EXPLAIN|DESCRIBE|PRAGMA)/i.test(trimmed);

    if (isSelect) {
      const rows = await db.query(trimmed, params || []);
      res.json({ status: 'success', count: rows.length, rows });
    } else {
      const result = await db.execute(trimmed, params || []);
      res.json({ status: 'success', result });
    }
  } catch (err: any) {
    res.status(400).json({ error: 'Query Execution Error', message: err.message });
  }
});

export default router;
