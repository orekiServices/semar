import { getDb } from '../db/index.js';
import { nodeService } from './node.service.js';
import { cacheService } from './cache.service.js';
import { semApiService } from './semapi.service.js';
import { metricsService } from './metrics.service.js';

export class StatsService {
  async getDashboardOverview() {
    const db = getDb();
    const nodes = await nodeService.listNodes();
    
    let totalLyricsInDb = 0;
    let totalApproxLyrics = 0;
    const nodeDistribution: Array<{ nodeId: string; name: string; count: number; approx: number; isNsfw: boolean }> = [];

    for (const node of nodes) {
      const count = node.real_record_count || 0;
      totalLyricsInDb += count;
      totalApproxLyrics += node.total_records_approx || count;
      nodeDistribution.push({
        nodeId: node.node_id,
        name: node.name,
        count,
        approx: node.total_records_approx || count,
        isNsfw: node.is_nsfw,
      });
    }

    const cacheStats = cacheService.getStats();
    const ytCountRes = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM youtube_cache');
    const semapiStats = await semApiService.getSemApiStats();
    const tables = await db.getTables();

    // Top tracks across nodes
    const topTracks: any[] = [];
    for (const node of nodes) {
      try {
        const rows = await db.query<any>(
          `SELECT id, title, artist, album, youtube_video_id, views_count 
           FROM lyrics_${node.node_id} 
           ORDER BY views_count DESC 
           LIMIT 3`
        );
        topTracks.push(...rows.map((r) => ({ ...r, node_id: node.node_id })));
      } catch {}
    }
    topTracks.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));

    // v2.1 — REAL 24-hour request timeline from the metrics engine
    // (previously simulated with Math.random). Falls back to persisted
    // system_metrics history when the process just booted.
    const hoursTimeline = await this.getRequestTimeline(24);

    // v2.1 — pending community submissions awaiting moderation
    let pendingSubmissions = 0;
    try {
      const sub = await db.queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM lyrics_submissions WHERE status = 'pending'"
      );
      pendingSubmissions = sub?.count || 0;
    } catch {}

    return {
      overview: {
        totalLyricsInDb,
        totalApproxLyrics,
        activeNodes: nodes.length,
        activeSemApiRoutes: semapiStats.activeRoutes,
        totalSemApiRoutes: semapiStats.totalRoutes,
        totalSemApiCalls: semapiStats.totalCalls,
        youtubeCachedCount: ytCountRes?.count || 0,
        memoryCacheEntries: cacheStats.memoryEntries,
        cacheHitRate: cacheStats.hitRate,
        databaseType: db.type,
        totalTablesCount: tables.length,
        pendingSubmissions,
      },
      nodeDistribution,
      topTracks: topTracks.slice(0, 8),
      cacheStats,
      timeline: hoursTimeline,
      realtime: metricsService.getSnapshot(),
    };
  }

  /**
   * v2.1 — Merge live in-memory buckets with persisted history so the
   * dashboard shows real traffic immediately after boot.
   */
  async getRequestTimeline(hours: number = 24) {
    const live = metricsService.getHourlyTimeline(hours);
    const liveTotal = live.reduce((acc, b) => acc + b.requests, 0);
    if (liveTotal > 0) return live;

    // No live traffic yet — try persisted aggregate history
    try {
      const db = getDb();
      const rows = await db.query<any>(
        `SELECT value, metadata FROM system_metrics
         WHERE category = 'http' AND metric_name = 'requests_per_hour'
         ORDER BY id DESC LIMIT ?`,
        [hours]
      );
      if (rows.length > 0) {
        const byHour = new Map<string, { requests: number; errors: number }>();
        for (const r of rows) {
          try {
            const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata || {};
            if (meta.hour) byHour.set(meta.hour, { requests: Number(r.value) || 0, errors: Number(meta.errors) || 0 });
          } catch {}
        }
        return live.map((b) => {
          const hist = byHour.get(b.hour);
          return hist ? { ...b, requests: hist.requests, errors: hist.errors } : b;
        });
      }
    } catch {}
    return live;
  }

  async recordMetric(category: string, metricName: string, value: number, metadata: any = {}) {
    const db = getDb();
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata || '{}';
    await db.execute(
      'INSERT INTO system_metrics (category, metric_name, value, metadata) VALUES (?, ?, ?, ?)',
      [category, metricName, value, metaStr]
    );
  }
}

export const statsService = new StatsService();
