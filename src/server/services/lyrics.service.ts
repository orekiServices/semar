import { getDb } from '../db/index.js';
import { cacheService } from './cache.service.js';
import { nodeService } from './node.service.js';
import { lrcToTtml, ttmlToLrc } from './ttml.util.js';

export interface LyricsRecord {
  id?: number;
  title: string;
  artist: string;
  album?: string;
  youtube_video_id?: string;
  duration?: number;
  plain_lyrics?: string;
  synced_lyrics?: string;
  ttml_lyrics?: string;
  metadata?: any;
  is_explicit?: boolean;
  views_count?: number;
  created_at?: string;
  updated_at?: string;
  node_id?: string;
}

export class LyricsService {
  async searchAll(query: string, limit: number = 20, options: { nsfw?: boolean; nodeIds?: string[] } = {}): Promise<LyricsRecord[]> {
    const nodes = await nodeService.listNodes();
    // v2.1: optional node restriction (used by scoped API keys)
    const allowed = options.nodeIds && options.nodeIds.length > 0 ? new Set(options.nodeIds.map((n) => n.toLowerCase())) : null;
    const activeNodes = nodes.filter(
      (n) => n.status === 'active' && (options.nsfw ? true : !n.is_nsfw) && (!allowed || allowed.has(n.node_id.toLowerCase()))
    );

    const results: LyricsRecord[] = [];
    for (const node of activeNodes) {
      try {
        const nodeResults = await this.searchNode(node.node_id, query, limit);
        results.push(...nodeResults);
      } catch {
        // ignore errors on single node table
      }
    }

    // Sort by relevance / view counts
    results.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    return results.slice(0, limit);
  }

  async searchNode(nodeId: string, query: string, limit: number = 20, offset: number = 0): Promise<LyricsRecord[]> {
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    let sql = `SELECT * FROM "${tableName}"`;
    const params: any[] = [];

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      sql += ` WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR youtube_video_id LIKE ? OR plain_lyrics LIKE ?`;
      params.push(q, q, q, q, q);
    }

    sql += ` ORDER BY views_count DESC, id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await db.query<any>(sql, params);
    return rows.map((r) => {
      let ttml = r.ttml_lyrics;
      if (!ttml && r.synced_lyrics) {
        ttml = lrcToTtml(r.synced_lyrics, r.title, r.artist, r.duration || 200);
      }
      return {
        ...r,
        node_id: sanitizedNodeId,
        ttml_lyrics: ttml,
        is_explicit: Boolean(r.is_explicit),
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata,
      };
    });
  }

  async countNodeLyrics(nodeId: string, query: string = ''): Promise<number> {
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    let sql = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const params: any[] = [];

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      sql += ` WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR youtube_video_id LIKE ? OR plain_lyrics LIKE ?`;
      params.push(q, q, q, q, q);
    }

    const res = await db.queryOne<{ count: number }>(sql, params);
    return res?.count || 0;
  }

  async getLyricsById(nodeId: string, id: number): Promise<LyricsRecord | null> {
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    const row = await db.queryOne<any>(`SELECT * FROM "${tableName}" WHERE id = ?`, [id]);
    if (!row) return null;

    // Async increment views
    db.execute(`UPDATE "${tableName}" SET views_count = views_count + 1 WHERE id = ?`, [id]).catch(() => {});

    let ttml = row.ttml_lyrics;
    if (!ttml && row.synced_lyrics) {
      ttml = lrcToTtml(row.synced_lyrics, row.title, row.artist, row.duration || 200);
    }

    return {
      ...row,
      node_id: sanitizedNodeId,
      ttml_lyrics: ttml,
      is_explicit: Boolean(row.is_explicit),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata,
    };
  }

  /**
   * v2.1 — Trending tracks: top records by views_count across all active
   * public nodes. Cached in memory for 5 minutes.
   */
  async getTrending(limit: number = 10, options: { nsfw?: boolean } = {}): Promise<LyricsRecord[]> {
    const cacheKey = `trending:${limit}:${options.nsfw ? 'nsfw' : 'safe'}`;
    const cached = cacheService.get<LyricsRecord[]>(cacheKey);
    if (cached) return cached;

    const nodes = await nodeService.listNodes();
    const activeNodes = nodes.filter((n) => n.status === 'active' && (options.nsfw ? true : !n.is_nsfw));

    const perNode = Math.max(Math.ceil(limit / Math.max(activeNodes.length, 1)), 3);
    const pooled: LyricsRecord[] = [];
    for (const node of activeNodes) {
      try {
        const top = await this.searchNode(node.node_id, '', perNode);
        pooled.push(...top);
      } catch {
        // ignore single-node errors
      }
    }
    pooled.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    const result = pooled.slice(0, limit);
    cacheService.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  async getByYouTubeId(youtubeVideoId: string): Promise<LyricsRecord | null> {
    if (!youtubeVideoId) return null;
    const cleanId = youtubeVideoId.trim();

    // 1. Check YouTube Cache (memory + table)
    const cached = await cacheService.getYouTubeCache(cleanId);
    if (cached) {
      let ttml = cached.ttml_lyrics;
      if (!ttml && cached.synced_lyrics) {
        ttml = lrcToTtml(cached.synced_lyrics, cached.title, cached.artist, cached.duration || 200);
      }
      return {
        id: cached.song_id,
        node_id: cached.node_id,
        title: cached.title,
        artist: cached.artist,
        album: cached.album,
        youtube_video_id: cached.youtube_video_id,
        duration: cached.duration,
        plain_lyrics: cached.plain_lyrics,
        synced_lyrics: cached.synced_lyrics,
        ttml_lyrics: ttml,
        metadata: cached.metadata,
        views_count: cached.hit_count,
      };
    }

    // 2. Search across node tables
    const nodes = await nodeService.listNodes();
    for (const node of nodes) {
      const db = getDb();
      const tableName = `lyrics_${node.node_id}`;
      try {
        const row = await db.queryOne<any>(
          `SELECT * FROM "${tableName}" WHERE youtube_video_id = ?`,
          [cleanId]
        );
        if (row) {
          let ttml = row.ttml_lyrics;
          if (!ttml && row.synced_lyrics) {
            ttml = lrcToTtml(row.synced_lyrics, row.title, row.artist, row.duration || 200);
          }

          const parsed = {
            ...row,
            node_id: node.node_id,
            ttml_lyrics: ttml,
            is_explicit: Boolean(row.is_explicit),
            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata,
          };

          // Auto-promote to YouTube Video ID Cache!
          await cacheService.saveYouTubeCache({
            youtube_video_id: cleanId,
            song_id: row.id,
            node_id: node.node_id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            duration: row.duration,
            plain_lyrics: row.plain_lyrics,
            synced_lyrics: row.synced_lyrics,
            ttml_lyrics: ttml,
            metadata: parsed.metadata,
          });

          return parsed;
        }
      } catch {
        // continue
      }
    }

    return null;
  }

  async saveLyrics(nodeId: string, data: Partial<LyricsRecord>): Promise<{ insertId: number | string }> {
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    const isSqlite = db.type === 'sqlite';

    let synced = data.synced_lyrics || '';
    let ttml = data.ttml_lyrics || '';

    if (synced && !ttml) {
      ttml = lrcToTtml(synced, data.title, data.artist, data.duration || 200);
    } else if (ttml && !synced) {
      synced = ttmlToLrc(ttml);
    }

    const metaStr = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata || '{}';
    const isExplicit = data.is_explicit ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false);

    const res = await db.execute(
      `INSERT INTO "${tableName}" (title, artist, album, youtube_video_id, duration, plain_lyrics, synced_lyrics, ttml_lyrics, metadata, is_explicit, views_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.artist,
        data.album || '',
        data.youtube_video_id || '',
        data.duration || 0,
        data.plain_lyrics || '',
        synced,
        ttml,
        metaStr,
        isExplicit,
        data.views_count || 0,
      ]
    );

    // If YouTube ID present, associate cache
    if (data.youtube_video_id) {
      await cacheService.saveYouTubeCache({
        youtube_video_id: data.youtube_video_id,
        song_id: Number(res.insertId),
        node_id: sanitizedNodeId,
        title: data.title!,
        artist: data.artist!,
        album: data.album,
        duration: data.duration,
        plain_lyrics: data.plain_lyrics,
        synced_lyrics: synced,
        ttml_lyrics: ttml,
        metadata: data.metadata,
      });
    }

    return { insertId: res.insertId! };
  }

  async updateLyrics(nodeId: string, id: number, data: Partial<LyricsRecord>): Promise<boolean> {
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;
    const isSqlite = db.type === 'sqlite';

    const existing = await this.getLyricsById(sanitizedNodeId, id);
    if (!existing) return false;

    const title = data.title !== undefined ? data.title : existing.title;
    const artist = data.artist !== undefined ? data.artist : existing.artist;
    const album = data.album !== undefined ? data.album : existing.album;
    const ytId = data.youtube_video_id !== undefined ? data.youtube_video_id : existing.youtube_video_id;
    const duration = data.duration !== undefined ? data.duration : existing.duration;
    const plain = data.plain_lyrics !== undefined ? data.plain_lyrics : existing.plain_lyrics;
    let synced = data.synced_lyrics !== undefined ? data.synced_lyrics : existing.synced_lyrics;
    let ttml = data.ttml_lyrics !== undefined ? data.ttml_lyrics : existing.ttml_lyrics;

    if (data.synced_lyrics && !data.ttml_lyrics) {
      ttml = lrcToTtml(data.synced_lyrics, title, artist, duration || 200);
    } else if (data.ttml_lyrics && !data.synced_lyrics) {
      synced = ttmlToLrc(data.ttml_lyrics);
    }

    const metaStr = data.metadata !== undefined ? (typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata) : JSON.stringify(existing.metadata);
    const isExplicit = data.is_explicit !== undefined ? (data.is_explicit ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false)) : (existing.is_explicit ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false));

    await db.execute(
      `UPDATE "${tableName}"
       SET title = ?, artist = ?, album = ?, youtube_video_id = ?, duration = ?, plain_lyrics = ?, synced_lyrics = ?, ttml_lyrics = ?, metadata = ?, is_explicit = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, artist, album, ytId, duration, plain, synced, ttml, metaStr, isExplicit, id]
    );

    if (ytId) {
      await cacheService.saveYouTubeCache({
        youtube_video_id: ytId,
        song_id: id,
        node_id: sanitizedNodeId,
        title,
        artist,
        album,
        duration,
        plain_lyrics: plain,
        synced_lyrics: synced,
        ttml_lyrics: ttml,
        metadata: data.metadata || existing.metadata,
      });
    }

    return true;
  }

  async deleteLyrics(nodeId: string, id: number): Promise<boolean> {
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    const existing = await this.getLyricsById(sanitizedNodeId, id);
    if (existing && existing.youtube_video_id) {
      await cacheService.purgeYouTubeCache(existing.youtube_video_id);
    }

    await db.execute(`DELETE FROM "${tableName}" WHERE id = ?`, [id]);
    return true;
  }
}

export const lyricsService = new LyricsService();
