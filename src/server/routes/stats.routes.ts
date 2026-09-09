import { Router } from 'express';
import { statsService } from '../services/stats.service.js';
import { metricsService } from '../services/metrics.service.js';
import { cacheService } from '../services/cache.service.js';
import { getDb } from '../db/index.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/dashboard', requireAdminAuth, async (req, res, next) => {
  try {
    const data = await statsService.getDashboardOverview();
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// v2.1 — Live in-memory metrics snapshot (powers realtime panels)
router.get('/realtime', requireAdminAuth, async (req, res, next) => {
  try {
    const hours = Math.min(Math.max(parseInt((req.query.hours as string) || '24', 10), 1), 72);
    res.json({
      status: 'success',
      snapshot: metricsService.getSnapshot(),
      timeline: await statsService.getRequestTimeline(hours),
      cache: cacheService.getStats(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
