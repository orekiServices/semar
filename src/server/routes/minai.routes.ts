import { Router } from 'express';
import { minaiService } from '../services/minai.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

// Public: model status (powers the AI page empty-state)
router.get('/status', async (req, res, next) => {
  try {
    const status = await minaiService.getStatus();
    res.json({ status: 'success', minai: status });
  } catch (err) {
    next(err);
  }
});

// Admin: (re)train on the full local catalog
router.post('/train', requireAdminAuth, async (req, res, next) => {
  try {
    const { maxTracks, order } = req.body || {};
    const stats = await minaiService.trainModel({ maxTracks, order });
    await logsService.recordAudit('MINAI_TRAINED', (req as any).user?.username, stats as any, req.ip);
    res.json({ status: 'success', message: `MIN-AI trained on ${stats.tracks} tracks (${stats.states} states)`, stats });
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Public: generate original lyric lines
router.post('/generate', async (req, res, next) => {
  try {
    const { seed, lines, wordsPerLine, artist, rngSeed } = req.body || {};
    const result = await minaiService.generate({ seed, lines, wordsPerLine, artist, rngSeed });
    res.json({ status: 'success', ...result });
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Public: AI Finder — vibe/keyword ranked search
router.get('/finder', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 50);
    const results = await minaiService.finder(q, limit);
    res.json({ status: 'success', query: q, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// Public: similar tracks ("more like this")
router.get('/similar/:nodeId/:id', async (req, res, next) => {
  try {
    const { nodeId, id } = req.params;
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '8', 10), 1), 30);
    const results = await minaiService.similar(nodeId as string, id as string, limit);
    res.json({ status: 'success', count: results.length, results });
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

export default router;
