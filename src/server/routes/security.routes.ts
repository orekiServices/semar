import { Router } from 'express';
import { authService } from '../services/auth.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

router.get('/api-keys', requireAdminAuth, async (req, res, next) => {
  try {
    const keys = await authService.listApiKeys();
    res.json({ status: 'success', count: keys.length, keys });
  } catch (err) {
    next(err);
  }
});

router.post('/api-keys', requireAdminAuth, async (req, res, next) => {
  try {
    const { name, permissions, node_restrictions, rate_limit_rpm } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Key name is required' });
    }

    const created = await authService.generateApiKey(
      name,
      permissions || ['read'],
      node_restrictions || [],
      Number(rate_limit_rpm) || 120
    );

    await logsService.recordAudit('API_KEY_CREATED', (req as any).user?.username, { keyId: created.keyItem.id, name }, req.ip);

    res.status(201).json({
      status: 'success',
      key: created.keyItem,
      rawKey: created.rawKey,
      warning: 'Save this API key now. It will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/api-keys/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    await authService.deleteApiKey(id);
    await logsService.recordAudit('API_KEY_REVOKED', (req as any).user?.username, { keyId: id }, req.ip);
    res.json({ status: 'success', message: 'API key deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/api-keys/:id/toggle', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await authService.toggleApiKey(id, Boolean(active));
    res.json({ status: 'success', id, active: Boolean(active) });
  } catch (err) {
    next(err);
  }
});

export default router;
