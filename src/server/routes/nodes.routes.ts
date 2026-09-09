import { Router } from 'express';
import { nodeService } from '../services/node.service.js';
import { lyricsService } from '../services/lyrics.service.js';
import { isSpecialNode } from '../services/providers/index.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

// Public: list active nodes
router.get('/', async (req, res, next) => {
  try {
    const nodes = await nodeService.listNodes();
    res.json({
      status: 'success',
      count: nodes.length,
      nodes,
    });
  } catch (err) {
    next(err);
  }
});

// Public: get single node info + about
router.get('/:id', async (req, res, next) => {
  try {
    const node = await nodeService.getNode(req.params.id);
    if (!node) {
      return res.status(404).json({ error: `Node "${req.params.id}" not found` });
    }
    res.json({
      status: 'success',
      node,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: create node
router.post('/', requireAdminAuth, async (req, res, next) => {
  try {
    const { node_id, name, description, storage_mode, is_nsfw, rate_limit, total_records_approx, about_config, api_config } = req.body;
    if (!node_id || !name) {
      return res.status(400).json({ error: 'node_id and name are required' });
    }

    const created = await nodeService.createNode({
      node_id,
      name,
      description,
      storage_mode,
      is_nsfw: Boolean(is_nsfw),
      rate_limit: Number(rate_limit) || 120,
      total_records_approx: Number(total_records_approx) || 0,
      about_config,
      api_config,
    });

    await logsService.recordAudit('NODE_CREATED', (req as any).user?.username, { nodeId: node_id }, req.ip);
    res.status(201).json({ status: 'success', node: created });
  } catch (err) {
    next(err);
  }
});

// Admin: update node
router.put('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    if (isSpecialNode(req.params.id as string)) {
      return res.status(400).json({ error: `Special external node "${req.params.id}" is managed by its provider and cannot be modified.` });
    }
    const updated = await nodeService.updateNode(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: `Node "${req.params.id}" not found` });
    }
    await logsService.recordAudit('NODE_UPDATED', (req as any).user?.username, { nodeId: req.params.id }, req.ip);
    res.json({ status: 'success', node: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: delete node
router.delete('/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const nodeId = req.params.id;
    if (isSpecialNode(nodeId as string)) {
      return res.status(400).json({ error: `Special external node "${nodeId}" cannot be deleted.` });
    }
    await nodeService.deleteNode(nodeId);
    await logsService.recordAudit('NODE_DELETED', (req as any).user?.username, { nodeId }, req.ip);
    res.json({ status: 'success', message: `Node "${nodeId}" deleted successfully` });
  } catch (err) {
    next(err);
  }
});

// Public / Admin: Browse lyrics inside a specific node
router.get('/:id/lyrics', async (req, res, next) => {
  try {
    const nodeId = req.params.id;
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const offset = (page - 1) * limit;

    const lyrics = await lyricsService.searchNode(nodeId, query, limit, offset);
    const total = await lyricsService.countNodeLyrics(nodeId, query);

    res.json({
      status: 'success',
      nodeId,
      page,
      limit,
      total,
      lyrics,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Add lyrics to node
router.post('/:id/lyrics', requireAdminAuth, async (req, res, next) => {
  try {
    const nodeId = req.params.id;
    if (isSpecialNode(nodeId as string)) {
      return res.status(400).json({ error: `Cannot write to special external node "${nodeId}".` });
    }
    const result = await lyricsService.saveLyrics(nodeId, req.body);
    await logsService.recordAudit('LYRICS_CREATED', (req as any).user?.username, { nodeId, songId: result.insertId, title: req.body.title }, req.ip);
    res.status(201).json({
      status: 'success',
      songId: result.insertId,
      nodeId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
