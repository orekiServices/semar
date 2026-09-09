import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

// Public: Get Branding + About for public consumption
router.get('/public', async (req, res, next) => {
  try {
    const db = getDb();
    const brandingRow = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', ['branding']);
    const aboutRow = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', ['about']);

    const branding = brandingRow ? (typeof brandingRow.value === 'string' ? JSON.parse(brandingRow.value) : brandingRow.value) : {};
    const about = aboutRow ? (typeof aboutRow.value === 'string' ? JSON.parse(aboutRow.value) : aboutRow.value) : {};

    res.json({
      status: 'success',
      branding,
      about,
      engine: 'Semar v2.0.0',
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Get all settings
router.get('/', requireAdminAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.query<any>('SELECT * FROM system_config');
    const settings: Record<string, any> = {};

    for (const r of rows) {
      settings[r.key] = typeof r.value === 'string' ? JSON.parse(r.value || '{}') : r.value;
    }

    res.json({
      status: 'success',
      settings,
      databaseType: db.type,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        isVercel: Boolean(process.env.VERCEL),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Update System Settings
router.put('/', requireAdminAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const settings = req.body;
    const isSqlite = db.type === 'sqlite';

    for (const [key, val] of Object.entries(settings)) {
      const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const existing = await db.queryOne('SELECT key FROM system_config WHERE key = ?', [key]);
      if (existing) {
        await db.execute('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [valStr, key]);
      } else {
        await db.execute('INSERT INTO system_config (key, value) VALUES (?, ?)', [key, valStr]);
      }
    }

    await logsService.recordAudit('SETTINGS_UPDATED', (req as any).user?.username, {}, req.ip);
    res.json({ status: 'success', message: 'Settings saved' });
  } catch (err) {
    next(err);
  }
});

// Admin: Update Branding specifically
router.put('/branding', requireAdminAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const valStr = JSON.stringify(req.body);
    await db.execute('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [valStr, 'branding']);
    await logsService.recordAudit('BRANDING_UPDATED', (req as any).user?.username, {}, req.ip);
    res.json({ status: 'success', message: 'Branding updated' });
  } catch (err) {
    next(err);
  }
});

// Admin: Update About specifically
router.put('/about', requireAdminAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const valStr = JSON.stringify(req.body);
    await db.execute('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [valStr, 'about']);
    await logsService.recordAudit('ABOUT_CONFIG_UPDATED', (req as any).user?.username, {}, req.ip);
    res.json({ status: 'success', message: 'About page configuration updated' });
  } catch (err) {
    next(err);
  }
});

export default router;
