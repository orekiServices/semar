/**
 * Semar v2.1 — Real request metrics engine.
 *
 * Records every HTTP hit into an in-memory ring buffer (no per-request DB
 * writes), exposes an hourly timeline for the dashboard, a Prometheus
 * exposition endpoint, and periodically flushes aggregated counters into
 * the persistent `system_metrics` table.
 */

export interface HitRecord {
  ts: number;
  route: string;
  method: string;
  status: number;
  latencyMs: number;
}

export interface TimelineBucket {
  hour: string;
  timestamp: number;
  requests: number;
  errors: number;
  avgLatencyMs: number;
}

const MAX_HITS = 50000;
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

class MetricsService {
  private hits: HitRecord[] = [];
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private latencySum: number = 0;
  private statusCounts: Map<number, number> = new Map();
  private routeCounts: Map<string, number> = new Map();
  private bootTime: number = Date.now();
  private lastFlushAt: number = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /** Normalize a raw path into a low-cardinality route label. */
  normalizeRoute(path: string): string {
    if (!path) return '/';
    let p = path.split('?')[0];
    // Collapse numeric IDs and long hex/uuid segments
    p = p.replace(/\/[0-9a-fA-F-]{8,}([/]|$)/g, '/:id$1');
    p = p.replace(/\/\d+([/]|$)/g, '/:id$1');
    // Collapse YouTube video ids & slugs to keep cardinality low
    p = p.replace(/(\/youtube\/)[^/]+/, '$1:id');
    // Strip trailing slash (except root) so /x and /x/ aggregate together
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    if (p.length > 120) p = p.slice(0, 120);
    return p || '/';
  }

  recordHit(route: string, method: string, status: number, latencyMs: number): void {
    const normalized = this.normalizeRoute(route);
    const record: HitRecord = { ts: Date.now(), route: normalized, method, status, latencyMs };
    this.hits.push(record);
    if (this.hits.length > MAX_HITS) {
      this.hits.splice(0, this.hits.length - MAX_HITS);
    }
    this.totalRequests++;
    this.latencySum += latencyMs;
    if (status >= 500) this.totalErrors++;
    this.statusCounts.set(status, (this.statusCounts.get(status) || 0) + 1);
    const routeKey = `${method} ${normalized}`;
    this.routeCounts.set(routeKey, (this.routeCounts.get(routeKey) || 0) + 1);
  }

  /** Real hourly request timeline for the last `hours` hours. */
  getHourlyTimeline(hours: number = 24): TimelineBucket[] {
    const now = Date.now();
    const buckets: TimelineBucket[] = [];
    for (let i = hours - 1; i >= 0; i--) {
      const bucketStart = Math.floor((now - i * 3600_000) / 3600_000) * 3600_000;
      const bucketEnd = bucketStart + 3600_000;
      const d = new Date(bucketStart);
      buckets.push({
        hour: `${String(d.getHours()).padStart(2, '0')}:00`,
        timestamp: bucketStart,
        requests: 0,
        errors: 0,
        avgLatencyMs: 0,
      });
      // aggregate hits into this bucket
      let latSum = 0;
      let latCount = 0;
      for (const h of this.hits) {
        if (h.ts >= bucketStart && h.ts < bucketEnd) {
          const b = buckets[buckets.length - 1];
          b.requests++;
          if (h.status >= 500) b.errors++;
          latSum += h.latencyMs;
          latCount++;
        }
      }
      if (latCount > 0) {
        buckets[buckets.length - 1].avgLatencyMs = Math.round((latSum / latCount) * 100) / 100;
      }
    }
    return buckets;
  }

  /** Top routes by hit count (for dashboard / realtime panels). */
  getTopRoutes(limit: number = 10): Array<{ route: string; count: number }> {
    return [...this.routeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([route, count]) => ({ route, count }));
  }

  getSnapshot() {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.bootTime) / 1000),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 ? parseFloat(((this.totalErrors / this.totalRequests) * 100).toFixed(2)) : 0,
      avgLatencyMs: this.totalRequests > 0 ? Math.round((this.latencySum / this.totalRequests) * 100) / 100 : 0,
      hitsBuffered: this.hits.length,
      topRoutes: this.getTopRoutes(8),
    };
  }

  /** Prometheus text exposition format. */
  renderPrometheus(extra: { cacheEntries?: number; cacheHitRate?: number; semapiCalls?: number; dbType?: string } = {}): string {
    const lines: string[] = [];
    lines.push('# HELP semar_http_requests_total Total HTTP requests served since boot');
    lines.push('# TYPE semar_http_requests_total counter');
    lines.push(`semar_http_requests_total ${this.totalRequests}`);
    lines.push('# HELP semar_http_errors_total Total HTTP 5xx responses since boot');
    lines.push('# TYPE semar_http_errors_total counter');
    lines.push(`semar_http_errors_total ${this.totalErrors}`);
    lines.push('# HELP semar_http_status_total HTTP responses by status code');
    lines.push('# TYPE semar_http_status_total counter');
    for (const [status, count] of this.statusCounts.entries()) {
      lines.push(`semar_http_status_total{status="${status}"} ${count}`);
    }
    lines.push('# HELP semar_http_route_requests_total HTTP requests by route');
    lines.push('# TYPE semar_http_route_requests_total counter');
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    for (const [route, count] of [...this.routeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)) {
      const [method, ...rest] = route.split(' ');
      lines.push(`semar_http_route_requests_total{method="${method}",route="${esc(rest.join(' '))}"} ${count}`);
    }
    lines.push('# HELP semar_process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE semar_process_uptime_seconds gauge');
    lines.push(`semar_process_uptime_seconds ${Math.floor((Date.now() - this.bootTime) / 1000)}`);
    lines.push('# HELP semar_process_memory_bytes Process memory usage in bytes');
    lines.push('# TYPE semar_process_memory_bytes gauge');
    const mem = process.memoryUsage();
    lines.push(`semar_process_memory_bytes{area="rss"} ${mem.rss}`);
    lines.push(`semar_process_memory_bytes{area="heap_used"} ${mem.heapUsed}`);
    lines.push(`semar_process_memory_bytes{area="heap_total"} ${mem.heapTotal}`);
    if (extra.cacheEntries !== undefined) {
      lines.push('# HELP semar_cache_memory_entries In-memory LRU entries');
      lines.push('# TYPE semar_cache_memory_entries gauge');
      lines.push(`semar_cache_memory_entries ${extra.cacheEntries}`);
    }
    if (extra.cacheHitRate !== undefined) {
      lines.push('# HELP semar_cache_hit_rate Cache hit rate percent');
      lines.push('# TYPE semar_cache_hit_rate gauge');
      lines.push(`semar_cache_hit_rate ${extra.cacheHitRate}`);
    }
    if (extra.semapiCalls !== undefined) {
      lines.push('# HELP semar_semapi_calls_total Total SemAPI executions');
      lines.push('# TYPE semar_semapi_calls_total counter');
      lines.push(`semar_semapi_calls_total ${extra.semapiCalls}`);
    }
    if (extra.dbType) {
      lines.push('# HELP semar_db_info Active database engine (1 = active)');
      lines.push('# TYPE semar_db_info gauge');
      lines.push(`semar_db_info{engine="${extra.dbType}"} 1`);
    }
    return lines.join('\n') + '\n';
  }

  /** Aggregate buffered hits and persist hourly counters to system_metrics. */
  async flushToDatabase(): Promise<{ persisted: boolean; hours: number }> {
    const now = Date.now();
    if (now - this.lastFlushAt < 60_000 && this.lastFlushAt !== 0) {
      return { persisted: false, hours: 0 };
    }
    this.lastFlushAt = now;
    try {
      const { getDb } = await import('../db/index.js');
      const db = getDb();
      const timeline = this.getHourlyTimeline(24);
      let hours = 0;
      for (const b of timeline) {
        if (b.requests === 0) continue;
        await db.execute(
          'INSERT INTO system_metrics (category, metric_name, value, metadata) VALUES (?, ?, ?, ?)',
          ['http', 'requests_per_hour', b.requests, JSON.stringify({ hour: b.hour, errors: b.errors, avgLatencyMs: b.avgLatencyMs })]
        );
        hours++;
      }
      // Drop buffered hits older than 26h to bound memory
      const cutoff = now - 26 * 3600_000;
      this.hits = this.hits.filter((h) => h.ts >= cutoff);
      return { persisted: true, hours };
    } catch {
      return { persisted: false, hours: 0 };
    }
  }

  /** Start periodic background flush (called once at server boot). */
  startAutoFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushToDatabase().catch(() => {});
    }, FLUSH_INTERVAL_MS);
    if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as any).unref();
    }
  }

  /** Reset all in-memory counters (used by tests). */
  reset(): void {
    this.hits = [];
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.latencySum = 0;
    this.statusCounts.clear();
    this.routeCounts.clear();
    this.bootTime = Date.now();
    this.lastFlushAt = 0;
  }
}

export const metricsService = new MetricsService();
