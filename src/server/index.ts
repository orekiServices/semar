import { createApp } from './app.js';
import { initDatabase, getDb } from './db/index.js';
import { cacheService } from './services/cache.service.js';
import { metricsService } from './services/metrics.service.js';
import { janitorService } from './services/janitor.service.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

async function bootstrap() {
  console.log('--------------------------------------------------');
  console.log('       ⁠♡ SEMAR LYRICS DATABASE ENGINE v2.1.0      ');
  console.log('--------------------------------------------------');

  try {
    console.log('[Semar] Initializing database layer & migrations...');
    const db = await initDatabase(true);
    console.log(`[Semar] Database ready: ${db.type.toUpperCase()}`);

    console.log('[Semar] Warming up YouTube Video ID & Lyrics cache...');
    const warmRes = await cacheService.warmup();
    console.log(`[Semar] Cache warmup complete: ${warmRes.loaded} keys preloaded.`);

    // v2.1 — background workers: metrics persistence + TTL janitor
    metricsService.startAutoFlush();
    console.log('[Semar] Metrics engine: live request tracking enabled (flush every 5 min).');
    janitorService.startScheduler();
    janitorService.runJanitor().then((r) => {
      console.log(`[Semar] Janitor sweep: ${r.expiredCachePurged} expired cache rows purged, ${r.semapiLogsPruned + r.auditLogsPruned + r.metricsPruned} old log rows pruned.`);
    }).catch(() => {});

    const app = createApp();

    const server = app.listen(PORT, HOST, () => {
      console.log(`[Semar] Server running at http://${HOST}:${PORT}`);
      console.log(`[Semar] Admin Panel: http://${HOST}:${PORT}/admin`);
      console.log(`[Semar] Setup Wizard: http://${HOST}:${PORT}/setup`);
      console.log(`[Semar] SemAPI Runtime: Active & Sandboxed`);
      console.log('--------------------------------------------------');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[Semar] SIGTERM received. Closing gracefully...');
      server.close(async () => {
        await db.close();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('[Semar] Failed to bootstrap server:', err);
    process.exit(1);
  }
}

bootstrap();
