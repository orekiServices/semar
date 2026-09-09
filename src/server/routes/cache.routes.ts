import { Router } from 'express';
import { cacheService } from '../services/cache.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

router.get('/stats', async (req, res, next) => {
  try {
    const stats = cacheService.getStats();
    res.json({ status: 'success', stats });
  } catch (err) {
    next(err);
  }
});

router.get('/youtube', async (req, res, next) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const search = (req.query.search as string) || '';

    const data = await cacheService.listYouTubeCache(page, limit, search);
    res.json({
      status: 'success',
      page,
      limit,
      total: data.total,
      items: data.items,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/youtube/:videoId', requireAdminAuth, async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const resPurge = await cacheService.purgeYouTubeCache(videoId);
    await logsService.recordAudit('CACHE_PURGED_YOUTUBE', (req as any).user?.username, { videoId }, req.ip);
    res.json({ status: 'success', purged: resPurge.purged });
  } catch (err) {
    next(err);
  }
});

router.post('/purge', requireAdminAuth, async (req, res, next) => {
  try {
    const resPurge = await cacheService.purgeYouTubeCache();
    await logsService.recordAudit('CACHE_PURGED_ALL', (req as any).user?.username, { purged: resPurge.purged }, req.ip);
    res.json({ status: 'success', purged: resPurge.purged, message: 'All memory and database cache entries purged.' });
  } catch (err) {
    next(err);
  }
});

// v2.1 — Purge only TTL-expired YouTube cache rows (janitor)
router.post('/purge-expired', requireAdminAuth, async (req, res, next) => {
  try {
    const resPurge = await cacheService.purgeExpired();
    await logsService.recordAudit('CACHE_PURGED_EXPIRED', (req as any).user?.username, { purged: resPurge.purged }, req.ip);
    res.json({ status: 'success', purged: resPurge.purged, message: `Purged ${resPurge.purged} expired cache entries.` });
  } catch (err) {
    next(err);
  }
});

router.post('/warmup', requireAdminAuth, async (req, res, next) => {
  try {
    const resWarm = await cacheService.warmup();
    await logsService.recordAudit('CACHE_WARMED', (req as any).user?.username, { loaded: resWarm.loaded }, req.ip);
    res.json({ status: 'success', loaded: resWarm.loaded, message: `Pre-loaded ${resWarm.loaded} high-priority cache items into memory.` });
  } catch (err) {
    next(err);
  }
});

export default router;
