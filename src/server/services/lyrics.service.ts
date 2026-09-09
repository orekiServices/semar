import { getDb } from '../db/index.js';
import { cacheService } from './cache.service.js';
import { nodeService } from './node.service.js';
import { lrcToTtml, ttmlToLrc } from './ttml.util.js';
import {
  SPECIAL_NODES,
  getSpecialNode,
  isExternalNodesEnabled,
  cachedProviderSearch,
  cachedProviderTrack,
  type ProviderTrack,
} from './providers/index.js';

export interface LyricsRecord {
  /** Numeric for local DB rows, string for some external providers. */
  id?: number | string;
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

/** True when a query failed only because the node table doesn't exist (yet). */
function isMissingTableError(err: any): boolean {
  const msg = String(err?.message || '');
  return /does not exist/i.test(msg) || /doesn.?t exist/i.test(msg) || /no such table/i.test(msg) || /undefined table/i.test(msg);
}

function mapProviderTrackToRecord(nodeId: string, t: ProviderTrack): LyricsRecord {
  let ttml: string | undefined;
  if (t.syncedLyrics) {
    try {
      ttml = lrcToTtml(t.syncedLyrics, t.title, t.artist, t.duration || 200);
    } catch {}
  }
  return {
    id: t.providerId,
    node_id: nodeId,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    plain_lyrics: t.plainLyrics,
    synced_lyrics: t.syncedLyrics,
    ttml_lyrics: ttml,
    is_explicit: false,
    views_count: 0,
    metadata: { provider: nodeId, providerUrl: t.providerUrl, instrumental: t.instrumental },
  };
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
    const localNodes = activeNodes.filter((n) => !n.is_special);
    const specialNodes = activeNodes.filter((n) => n.is_special);

    for (const node of localNodes) {
      try {
        const nodeResults = await this.searchNode(node.node_id, query, limit);
        results.push(...nodeResults);
      } catch {
        // ignore errors on single node table
      }
    }

    // v2.2: fan out to external special nodes (local results rank first)
    const q = (query || '').trim();
    if (q && specialNodes.length > 0) {
      const settled = await Promise.allSettled(
        specialNodes.map(async (n) => {
          const tracks = await cachedProviderSearch(n.node_id, q, limit);
          return tracks.map((t) => mapProviderTrackToRecord(n.node_id, t));
        })
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') results.push(...s.value);
      }
    }

    // Sort by relevance / view counts
    results.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    return results.slice(0, limit);
  }

  async searchNode(nodeId: string, query: string, limit: number = 20, offset: number = 0): Promise<LyricsRecord[]> {
    // v2.2 — special external nodes query their provider instead of a table
    const special = getSpecialNode(nodeId);
    if (special) {
      if (!(await isExternalNodesEnabled())) return [];
      const q = (query || '').trim();
      if (!q) return [];
      const tracks = await cachedProviderSearch(special.node_id, q, Math.min(limit + offset, 50));
      return tracks.slice(offset, offset + limit).map((t) => mapProviderTrackToRecord(special.node_id, t));
    }

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

    let rows: any[];
    try {
      rows = await db.query<any>(sql, params);
    } catch (err) {
      // v2.2 — missing table (fresh/no-data installs) reads as empty, not 500
      if (isMissingTableError(err)) return [];
      throw err;
    }
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
    // v2.2 — providers have unknown totals; report the fetched window size
    const special = getSpecialNode(nodeId);
    if (special) {
      const items = await this.searchNode(nodeId, query, 50, 0);
      return items.length >= 50 ? 50 : items.length;
    }

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

    try {
      const res = await db.queryOne<{ count: number }>(sql, params);
      return Number(res?.count) || 0;
    } catch (err) {
      if (isMissingTableError(err)) return 0;
      throw err;
    }
  }

  async getLyricsById(nodeId: string, id: number | string): Promise<LyricsRecord | null> {
    // v2.2 — special external nodes resolve via their provider
    const special = getSpecialNode(nodeId);
    if (special) {
      if (!(await isExternalNodesEnabled())) return null;
      const track = await cachedProviderTrack(special.node_id, String(id));
      return track ? mapProviderTrackToRecord(special.node_id, track) : null;
    }

    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (!Number.isFinite(numericId)) return null;

    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    let row: any;
    try {
      row = await db.queryOne<any>(`SELECT * FROM "${tableName}" WHERE id = ?`, [numericId]);
    } catch (err) {
      if (isMissingTableError(err)) return null;
      throw err;
    }
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
    const activeNodes = nodes.filter((n) => n.status === 'active' && !n.is_special && (options.nsfw ? true : !n.is_nsfw));

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

    // 2. Search across local node tables (specials have no tables)
    const nodes = await nodeService.listNodes();
    for (const node of nodes) {
      if (node.is_special) continue;
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

  /**
   * v2.2 — Random track from a random non-empty local node.
   */
  async getRandom(): Promise<LyricsRecord | null> {
    const nodes = await nodeService.listNodes();
    const candidates = nodes.filter((n) => n.status === 'active' && !n.is_special && !n.is_nsfw);
    if (candidates.length === 0) return null;

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (const node of shuffled.slice(0, 5)) {
      try {
        const db = getDb();
        const tableName = `lyrics_${node.node_id}`;
        const randFn = db.type === 'mysql' ? 'RAND()' : 'RANDOM()';
        const row = await db.queryOne<any>(`SELECT * FROM "${tableName}" ORDER BY ${randFn} LIMIT 1`);
        if (!row) continue;
        let ttml = row.ttml_lyrics;
        if (!ttml && row.synced_lyrics) {
          ttml = lrcToTtml(row.synced_lyrics, row.title, row.artist, row.duration || 200);
        }
        return {
          ...row,
          node_id: node.node_id,
          ttml_lyrics: ttml,
          is_explicit: Boolean(row.is_explicit),
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata,
        };
      } catch {
        // try next node
      }
    }
    return null;
  }

  async saveLyrics(nodeId: string, data: Partial<LyricsRecord>): Promise<{ insertId: number | string }> {
    if (getSpecialNode(nodeId)) throw new Error(`Cannot write to special external node "${nodeId}"`);
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

    let synced = data.synced_lyrics || '';
    let ttml = data.ttml_lyrics || '';

    if (synced && !ttml) {
      ttml = lrcToTtml(synced, data.title, data.artist, data.duration || 200);
    } else if (ttml && !synced) {
      synced = ttmlToLrc(ttml);
    }

    const metaStr = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata || '{}';
    const isExplicit = Boolean(data.is_explicit);

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
    if (getSpecialNode(nodeId)) throw new Error(`Cannot write to special external node "${nodeId}"`);
    const db = getDb();
    const sanitizedNodeId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = `lyrics_${sanitizedNodeId}`;

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
    const isExplicit = data.is_explicit !== undefined ? (Boolean(data.is_explicit)) : (Boolean(existing.is_explicit));

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
    if (getSpecialNode(nodeId)) throw new Error(`Cannot write to special external node "${nodeId}"`);
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
