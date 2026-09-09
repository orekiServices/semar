import { createApp } from './app.js';
import { initDatabase, getDb } from './db/index.js';
import { cacheService } from './services/cache.service.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

async function bootstrap() {
  console.log('--------------------------------------------------');
  console.log('       ⁠♡ SEMAR LYRICS DATABASE ENGINE v2.0.0      ');
  console.log('--------------------------------------------------');
  
  try {
    console.log('[Semar] Initializing database layer & migrations...');
    const db = await initDatabase(true);
    console.log(`[Semar] Database ready: ${db.type.toUpperCase()}`);

    console.log('[Semar] Warming up YouTube Video ID & Lyrics cache...');
    const warmRes = await cacheService.warmup();
    console.log(`[Semar] Cache warmup complete: ${warmRes.loaded} keys preloaded.`);

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
