import { LRUCache } from 'lru-cache';
import { getDb } from '../db/index.js';

export interface YouTubeCacheItem {
  youtube_video_id: string;
  song_id?: number;
  node_id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  plain_lyrics?: string;
  synced_lyrics?: string;
  ttml_lyrics?: string;
  metadata?: any;
  hit_count: number;
  last_accessed_at?: string;
  created_at?: string;
  expires_at?: string;
}

export class CacheService {
  private memoryCache: LRUCache<string, any>;
  private totalHits: number = 0;
  private totalMisses: number = 0;

  constructor() {
    this.memoryCache = new LRUCache<string, any>({
      max: 10000,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    });
  }

  get<T = any>(key: string): T | undefined {
    const item = this.memoryCache.get(key);
    if (item !== undefined) {
      this.totalHits++;
      return item as T;
    }
    this.totalMisses++;
    return undefined;
  }

  set(key: string, value: any, ttlMs?: number): void {
    this.memoryCache.set(key, value, { ttl: ttlMs });
  }

  delete(key: string): boolean {
    return this.memoryCache.delete(key);
  }

  clear(): void {
    this.memoryCache.clear();
  }

  // YouTube Video ID Cache Management
  async getYouTubeCache(videoId: string): Promise<YouTubeCacheItem | null> {
    if (!videoId) return null;
    const sanitizedId = videoId.trim();

    // 1. Check memory cache first
    const memKey = `yt:${sanitizedId}`;
    const memCached = this.get<YouTubeCacheItem>(memKey);
    if (memCached) {
      // Async update hit count in DB
      this.incrementYouTubeHit(sanitizedId).catch(() => {});
      return memCached;
    }

    // 2. Query persistent DB cache
    const db = getDb();
    const row = await db.queryOne<any>(
      'SELECT * FROM youtube_cache WHERE youtube_video_id = ?',
      [sanitizedId]
    );

    if (row) {
      const item: YouTubeCacheItem = {
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata,
        hit_count: Number(row.hit_count || 1) + 1,
      };

      // Update memory LRU
      this.set(memKey, item);

      // Async update hit count & timestamp in DB
      await this.incrementYouTubeHit(sanitizedId);

      return item;
    }

    return null;
  }

  async incrementYouTubeHit(videoId: string): Promise<void> {
    const db = getDb();
    await db.execute(
      `UPDATE youtube_cache 
       SET hit_count = hit_count + 1, last_accessed_at = CURRENT_TIMESTAMP
       WHERE youtube_video_id = ?`,
      [videoId]
    );
  }

  async saveYouTubeCache(item: Partial<YouTubeCacheItem> & { ttlDays?: number }): Promise<YouTubeCacheItem> {
    if (!item.youtube_video_id) throw new Error('youtube_video_id is required');
    const db = getDb();

    const existing = await db.queryOne<any>(
      'SELECT youtube_video_id FROM youtube_cache WHERE youtube_video_id = ?',
      [item.youtube_video_id]
    );

    const metaStr = typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : item.metadata || '{}';
    // v2.1 — optional TTL: expires_at timestamp for janitor-based eviction.
    // Stored as 'YYYY-MM-DD HH:MM:SS' (UTC) so lexical comparison works on
    // SQLite TEXT columns and parses natively on Postgres/MySQL.
    const toDbTimestamp = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const expiresAt = item.ttlDays && item.ttlDays > 0
      ? toDbTimestamp(new Date(Date.now() + item.ttlDays * 24 * 3600_000))
      : (item.expires_at || null);

    if (existing) {
      await db.execute(
        `UPDATE youtube_cache
         SET song_id = ?, node_id = ?, title = ?, artist = ?, album = ?, duration = ?, plain_lyrics = ?, synced_lyrics = ?, ttml_lyrics = ?, metadata = ?, expires_at = ?, last_accessed_at = CURRENT_TIMESTAMP
         WHERE youtube_video_id = ?`,
        [
          item.song_id || null,
          item.node_id || 'unknown',
          item.title || '',
          item.artist || '',
          item.album || '',
          item.duration || 0,
          item.plain_lyrics || '',
          item.synced_lyrics || '',
          item.ttml_lyrics || '',
          metaStr,
          expiresAt,
          item.youtube_video_id,
        ]
      );
    } else {
      await db.execute(
        `INSERT INTO youtube_cache (youtube_video_id, song_id, node_id, title, artist, album, duration, plain_lyrics, synced_lyrics, ttml_lyrics, metadata, expires_at, hit_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          item.youtube_video_id,
          item.song_id || null,
          item.node_id || 'unknown',
          item.title || '',
          item.artist || '',
          item.album || '',
          item.duration || 0,
          item.plain_lyrics || '',
          item.synced_lyrics || '',
          item.ttml_lyrics || '',
          metaStr,
          expiresAt,
        ]
      );
    }

    const saved = await this.getYouTubeCache(item.youtube_video_id);
    this.set(`yt:${item.youtube_video_id}`, saved);
    return saved!;
  }

  async listYouTubeCache(page: number = 1, limit: number = 20, search: string = ''): Promise<{ items: YouTubeCacheItem[]; total: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];
    if (search) {
      whereClause = `WHERE youtube_video_id LIKE ? OR title LIKE ? OR artist LIKE ? OR node_id LIKE ?`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const countRow = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM youtube_cache ${whereClause}`,
      params
    );
    const total = countRow?.count || 0;

    const rows = await db.query<any>(
      `SELECT * FROM youtube_cache ${whereClause} ORDER BY last_accessed_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const items = rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata,
      hit_count: Number(r.hit_count || 0),
    }));

    return { items, total };
  }

  /**
   * v2.1 — Delete only rows whose expires_at has passed (TTL janitor).
   * Also evicts them from the in-memory LRU.
   */
  async purgeExpired(): Promise<{ purged: number }> {
    const db = getDb();
    const expired = await db.query<{ youtube_video_id: string }>(
      'SELECT youtube_video_id FROM youtube_cache WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP'
    );
    let purged = 0;
    for (const row of expired) {
      this.delete(`yt:${row.youtube_video_id}`);
      const res = await db.execute('DELETE FROM youtube_cache WHERE youtube_video_id = ?', [row.youtube_video_id]);
      purged += res.rowsAffected || 0;
    }
    return { purged };
  }

  async purgeYouTubeCache(videoId?: string): Promise<{ purged: number }> {
    const db = getDb();
    if (videoId) {
      this.delete(`yt:${videoId}`);
      const res = await db.execute('DELETE FROM youtube_cache WHERE youtube_video_id = ?', [videoId]);
      return { purged: res.rowsAffected };
    } else {
      this.clear();
      const countRes = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM youtube_cache');
      const count = countRes?.count || 0;
      await db.execute('DELETE FROM youtube_cache');
      return { purged: count };
    }
  }

  async warmup(): Promise<{ loaded: number }> {
    const db = getDb();
    const topYt = await db.query<any>('SELECT * FROM youtube_cache ORDER BY hit_count DESC LIMIT 500');
    for (const item of topYt) {
      const parsed: YouTubeCacheItem = {
        ...item,
        metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : item.metadata,
      };
      this.set(`yt:${item.youtube_video_id}`, parsed);
    }
    return { loaded: topYt.length };
  }

  getStats() {
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0;
    return {
      memoryEntries: this.memoryCache.size,
      maxCapacity: this.memoryCache.max,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: parseFloat(hitRate.toFixed(2)),
    };
  }
}

export const cacheService = new CacheService();
