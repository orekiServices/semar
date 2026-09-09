import { Router } from 'express';
import { logsService } from '../services/logs.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/audit', requireAdminAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);
    const eventType = req.query.eventType as string;
    const logs = await logsService.listAuditLogs(limit, eventType);
    res.json({ status: 'success', count: logs.length, logs });
  } catch (err) {
    next(err);
  }
});

router.delete('/audit', requireAdminAuth, async (req, res, next) => {
  try {
    const cleared = await logsService.clearAuditLogs();
    res.json({ status: 'success', cleared, message: 'Audit logs cleared' });
  } catch (err) {
    next(err);
  }
});

export default router;
