import { Router } from 'express';
import { getDb, switchDatabase, initDatabase } from '../db/index.js';
import { authService } from '../services/auth.service.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

router.get('/status', async (req, res, next) => {
  try {
    const db = getDb();
    const adminCount = await authService.getAdminCount();
    const configRow = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', ['system_settings']);
    
    let isCompleted = adminCount > 0;
    if (configRow) {
      const parsed = typeof configRow.value === 'string' ? JSON.parse(configRow.value) : configRow.value;
      if (parsed && parsed.setupCompleted !== undefined) {
        isCompleted = parsed.setupCompleted && adminCount > 0;
      }
    }

    res.json({
      setupCompleted: isCompleted,
      databaseType: db.type,
      adminCount,
      environment: {
        isVercel: Boolean(process.env.VERCEL),
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/test-db', async (req, res, next) => {
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
    } else if (type === 'pglite') {
      const { PgliteAdapter } = await import('../db/pglite.js');
      const adapter = new PgliteAdapter(connectionString || undefined);
      testRes = await adapter.testConnection();
      await adapter.close();
    } else {
      testRes = { success: false, error: `Unsupported database type: ${type}` };
    }

    res.json(testRes);
  } catch (err: any) {
    res.json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/initialize', async (req, res, next) => {
  try {
    const { database, admin, branding, seedData } = req.body;

    // 1. Switch Database if requested
    if (database && database.type) {
      const switchRes = await switchDatabase(database.type, database.connectionString || database.config);
      if (!switchRes.success) {
        return res.status(400).json({ error: `Database connection failed: ${switchRes.error}` });
      }
    }

    const db = getDb();

    // 2. Create Admin Account
    if (admin && admin.username && admin.password) {
      const existing = await db.queryOne('SELECT username FROM admin_users WHERE username = ?', [admin.username]);
      if (existing) {
        await authService.changeAdminPassword(admin.username, admin.password);
      } else {
        await authService.createAdminUser(admin.username, admin.password, 'superadmin');
      }
    }

    // 3. Update Branding if supplied
    if (branding) {
      const brandStr = JSON.stringify(branding);
      await db.execute(
        'INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?',
        ['branding', brandStr, brandStr]
      ).catch(async () => {
        // Fallback for MySQL (no ON CONFLICT support)
        await db.execute('UPDATE system_config SET value = ? WHERE key = ?', [brandStr, 'branding']);
      });
    }

    // 4. Mark Setup Completed
    const systemSettingsStr = JSON.stringify({
      setupCompleted: true,
      completedAt: new Date().toISOString(),
      defaultNode: '',
    });
    await db.execute('UPDATE system_config SET value = ? WHERE key = ?', [systemSettingsStr, 'system_settings']);

    await logsService.recordAudit('SETUP_COMPLETED', admin?.username || 'setup_wizard', { dbType: db.type }, req.ip);

    // Auto-login newly created admin
    const auth = await authService.authenticateAdmin(admin.username, admin.password);

    res.json({
      success: true,
      message: 'Semar installation initialized successfully!',
      token: auth?.token,
      user: auth?.user,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
