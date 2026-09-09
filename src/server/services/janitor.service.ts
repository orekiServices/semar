import { getDb } from '../db/index.js';
import { cacheService } from './cache.service.js';

/**
 * v2.1 — Background maintenance janitor.
 * Purges expired YouTube cache rows and prunes oversized log/metric tables.
 */
export class JanitorService {
  async runJanitor(): Promise<{
    expiredCachePurged: number;
    semapiLogsPruned: number;
    auditLogsPruned: number;
    metricsPruned: number;
    ranAt: string;
  }> {
    const db = getDb();
    const toDbTimestamp = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const result = { expiredCachePurged: 0, semapiLogsPruned: 0, auditLogsPruned: 0, metricsPruned: 0, ranAt: new Date().toISOString() };

    // 1. Expired YouTube cache entries
    try {
      const purge = await cacheService.purgeExpired();
      result.expiredCachePurged = purge.purged;
    } catch {}

    // 2. Prune semapi_logs older than 30 days (keep table bounded)
    try {
      const cutoff = toDbTimestamp(new Date(Date.now() - 30 * 24 * 3600_000));
      const r = await db.execute('DELETE FROM semapi_logs WHERE created_at < ?', [cutoff]);
      result.semapiLogsPruned = r.rowsAffected || 0;
    } catch {}

    // 3. Prune audit_logs older than 90 days
    try {
      const cutoff = toDbTimestamp(new Date(Date.now() - 90 * 24 * 3600_000));
      const r = await db.execute('DELETE FROM audit_logs WHERE created_at < ?', [cutoff]);
      result.auditLogsPruned = r.rowsAffected || 0;
    } catch {}

    // 4. Prune system_metrics older than 30 days
    try {
      const cutoff = toDbTimestamp(new Date(Date.now() - 30 * 24 * 3600_000));
      const tsCol = 'timestamp';
      const r = await db.execute(
        db.type === 'mysql' ? `DELETE FROM system_metrics WHERE \`${tsCol}\` < ?` : `DELETE FROM system_metrics WHERE ${tsCol} < ?`,
        [cutoff]
      );
      result.metricsPruned = r.rowsAffected || 0;
    } catch {}

    return result;
  }

  startScheduler(intervalMs: number = 6 * 3600_000): void {
    if (process.env.DISABLE_JANITOR === '1' || process.env.VERCEL) return;
    const timer = setInterval(() => {
      this.runJanitor().catch(() => {});
    }, intervalMs);
    if (typeof timer === 'object' && 'unref' in (timer as any)) {
      (timer as any).unref();
    }
  }
}

export const janitorService = new JanitorService();
