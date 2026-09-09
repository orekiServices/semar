import { Router } from 'express';
import { lyricsService } from '../services/lyrics.service.js';
import { cacheService } from '../services/cache.service.js';
import { requireAdminAuth, trackApiKey, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

/** v2.1 — enforce scoped API key permissions + node restrictions on public reads. */
function scopedNodeIds(req: AuthenticatedRequest): string[] | undefined {
  const restrictions = req.apiKey?.node_restrictions;
  return restrictions && restrictions.length > 0 ? restrictions : undefined;
}

function hasReadPermission(req: AuthenticatedRequest): boolean {
  if (req.user) return true; // admin session
  if (!req.apiKey) return true; // anonymous (policy already checked by trackApiKey)
  const perms: string[] = req.apiKey.permissions || [];
  return perms.includes('read') || perms.includes('admin') || perms.includes('*');
}

// Global Lyrics Search across nodes
router.get('/search', trackApiKey, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!hasReadPermission(req)) {
      return res.status(403).json({ error: 'Forbidden: API key lacks "read" permission' });
    }
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const nsfw = req.query.nsfw === 'true' || req.query.nsfw === '1';
    const nodeIds = scopedNodeIds(req);

    // If query looks like YouTube video ID
    if (query.startsWith('yt:') || query.startsWith('youtube:')) {
      const ytId = query.split(':')[1].trim();
      const ytMatch = await lyricsService.getByYouTubeId(ytId);
      if (ytMatch && (!nodeIds || nodeIds.map((n) => n.toLowerCase()).includes((ytMatch.node_id || '').toLowerCase()))) {
        return res.json({
          status: 'success',
          source: 'youtube_cache_resolver',
          count: 1,
          results: [ytMatch],
        });
      }
    }

    const results = await lyricsService.searchAll(query, limit, { nsfw, nodeIds });
    res.json({
      status: 'success',
      query,
      count: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
});

// v2.1 — Trending tracks across active nodes (by view count, cached 5 min)
router.get('/trending', trackApiKey, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!hasReadPermission(req)) {
      return res.status(403).json({ error: 'Forbidden: API key lacks "read" permission' });
    }
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 50);
    const nsfw = req.query.nsfw === 'true' || req.query.nsfw === '1';
    let tracks = await lyricsService.getTrending(limit, { nsfw });
    const nodeIds = scopedNodeIds(req);
    if (nodeIds) {
      const allowed = new Set(nodeIds.map((n) => n.toLowerCase()));
      tracks = tracks.filter((t) => allowed.has((t.node_id || '').toLowerCase()));
    }
    res.json({
      status: 'success',
      count: tracks.length,
      results: tracks,
    });
  } catch (err) {
    next(err);
  }
});

// YouTube Video ID direct lookup & cache resolver
router.get('/youtube/:videoId', trackApiKey, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!hasReadPermission(req)) {
      return res.status(403).json({ error: 'Forbidden: API key lacks "read" permission' });
    }
    const videoId = req.params.videoId as string;
    if (!videoId) {
      return res.status(400).json({ error: 'YouTube videoId parameter is required' });
    }

    const nodeIds = scopedNodeIds(req);
    const result = await lyricsService.getByYouTubeId(videoId);
    if (!result || (nodeIds && !nodeIds.map((n) => n.toLowerCase()).includes((result.node_id || '').toLowerCase()))) {
      return res.status(404).json({
        status: 'not_found',
        message: `No cached lyrics found for YouTube Video ID "${videoId}"`,
        videoId,
      });
    }

    res.json({
      status: 'success',
      source: 'youtube_lyrics_cache',
      videoId,
      nodeId: result.node_id,
      lyrics: result,
    });
  } catch (err) {
    next(err);
  }
});

// Associate YouTube Video ID with existing or new lyrics
router.post('/youtube/associate', requireAdminAuth, async (req, res, next) => {
  try {
    const { videoId, nodeId, songId, title, artist, album, duration, plainLyrics, syncedLyrics, metadata } = req.body;
    if (!videoId || !nodeId) {
      return res.status(400).json({ error: 'videoId and nodeId are required' });
    }

    const saved = await cacheService.saveYouTubeCache({
      youtube_video_id: videoId,
      song_id: songId,
      node_id: nodeId,
      title: title || 'Untitled',
      artist: artist || 'Unknown Artist',
      album,
      duration,
      plain_lyrics: plainLyrics,
      synced_lyrics: syncedLyrics,
      metadata,
    });

    // Also update node lyrics record if songId provided
    if (songId) {
      await lyricsService.updateLyrics(nodeId, songId, { youtube_video_id: videoId });
    }

    await logsService.recordAudit('YOUTUBE_ASSOCIATED', (req as any).user?.username, { videoId, nodeId, songId }, req.ip);

    res.json({
      status: 'success',
      message: `YouTube Video ID "${videoId}" successfully mapped to lyrics`,
      cacheItem: saved,
    });
  } catch (err) {
    next(err);
  }
});

// Get single lyrics record (supports JSON or raw TTML)
router.get('/:nodeId/:id', trackApiKey, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!hasReadPermission(req)) {
      return res.status(403).json({ error: 'Forbidden: API key lacks "read" permission' });
    }
    const nodeId = req.params.nodeId as string;
    const id = req.params.id as string;
    const nodeIds = scopedNodeIds(req);
    if (nodeIds && !nodeIds.map((n) => n.toLowerCase()).includes(nodeId.toLowerCase())) {
      return res.status(403).json({ error: `Forbidden: API key is not scoped to node "${nodeId}"` });
    }
    const lyrics = await lyricsService.getLyricsById(nodeId, parseInt(id, 10));
    if (!lyrics) {
      return res.status(404).json({ error: `Lyrics not found in node "${nodeId}" with ID ${id}` });
    }

    if (req.query.format === 'ttml') {
      res.setHeader('Content-Type', 'application/xml');
      return res.send(lyrics.ttml_lyrics || '');
    }

    res.json({
      status: 'success',
      lyrics,
    });
  } catch (err) {
    next(err);
  }
});

// Dedicated raw TTML endpoint
router.get('/:nodeId/:id/ttml', trackApiKey, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!hasReadPermission(req)) {
      return res.status(403).json({ error: 'Forbidden: API key lacks "read" permission' });
    }
    const nodeId = req.params.nodeId as string;
    const id = req.params.id as string;
    const nodeIds = scopedNodeIds(req);
    if (nodeIds && !nodeIds.map((n) => n.toLowerCase()).includes(nodeId.toLowerCase())) {
      return res.status(403).json({ error: `Forbidden: API key is not scoped to node "${nodeId}"` });
    }
    const lyrics = await lyricsService.getLyricsById(nodeId, parseInt(id, 10));
    if (!lyrics || !lyrics.ttml_lyrics) {
      return res.status(404).json({ error: `TTML lyrics not available for track ID ${id}` });
    }
    res.setHeader('Content-Type', 'application/xml');
    res.send(lyrics.ttml_lyrics);
  } catch (err) {
    next(err);
  }
});

// Update single lyrics record
router.put('/:nodeId/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const nodeId = req.params.nodeId as string;
    const id = req.params.id as string;
    const success = await lyricsService.updateLyrics(nodeId, parseInt(id, 10), req.body);
    if (!success) {
      return res.status(404).json({ error: `Lyrics not found in node "${nodeId}" with ID ${id}` });
    }
    await logsService.recordAudit('LYRICS_UPDATED', (req as any).user?.username, { nodeId, songId: id, title: req.body.title }, req.ip);
    res.json({ status: 'success', message: 'Lyrics record updated' });
  } catch (err) {
    next(err);
  }
});

// Delete single lyrics record
router.delete('/:nodeId/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const nodeId = req.params.nodeId as string;
    const id = req.params.id as string;
    await lyricsService.deleteLyrics(nodeId, parseInt(id, 10));
    await logsService.recordAudit('LYRICS_DELETED', (req as any).user?.username, { nodeId, songId: id }, req.ip);
    res.json({ status: 'success', message: 'Lyrics record deleted' });
  } catch (err) {
    next(err);
  }
});

// Bulk import lyrics
router.post('/:nodeId/bulk-import', requireAdminAuth, async (req, res, next) => {
  try {
    const nodeId = req.params.nodeId as string;
    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    let inserted = 0;
    for (const item of items) {
      if (item.title && item.artist) {
        await lyricsService.saveLyrics(nodeId, item);
        inserted++;
      }
    }

    await logsService.recordAudit('LYRICS_BULK_IMPORTED', (req as any).user?.username, { nodeId, count: inserted }, req.ip);
    res.json({ status: 'success', count: inserted });
  } catch (err) {
    next(err);
  }
});

// Export lyrics
router.get('/:nodeId/export', requireAdminAuth, async (req, res, next) => {
  try {
    const nodeId = req.params.nodeId as string;
    const lyrics = await lyricsService.searchNode(nodeId, '', 10000);
    res.setHeader('Content-Disposition', `attachment; filename=semar-${nodeId}-lyrics-export.json`);
    res.json({
      nodeId,
      exportedAt: new Date().toISOString(),
      count: lyrics.length,
      lyrics,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
