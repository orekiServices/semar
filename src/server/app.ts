import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import setupRoutes from './routes/setup.routes.js';
import nodesRoutes from './routes/nodes.routes.js';
import lyricsRoutes from './routes/lyrics.routes.js';
import cacheRoutes from './routes/cache.routes.js';
import semapiRoutes from './routes/semapi.routes.js';
import databaseRoutes from './routes/database.routes.js';
import statsRoutes from './routes/stats.routes.js';
import logsRoutes from './routes/logs.routes.js';
import securityRoutes from './routes/security.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import pagesRoutes from './routes/pages.routes.js';
import submissionsRoutes from './routes/submissions.routes.js';
import minaiRoutes from './routes/minai.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { globalRateLimiter } from './middleware/rate-limit.middleware.js';
import { metricsMiddleware } from './middleware/metrics.middleware.js';
import { metricsService } from './services/metrics.service.js';
import { cacheService } from './services/cache.service.js';
import { semApiService } from './services/semapi.service.js';
import { getDb } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(globalRateLimiter(500));
  app.use(metricsMiddleware);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Semar Lyrics Engine',
      version: '2.2.0',
      timestamp: new Date().toISOString(),
    });
  });

  // v2.1 — Prometheus metrics exposition (safe public subset, no PII/secrets)
  app.get('/api/metrics', async (req, res) => {
    try {
      const cacheStats = cacheService.getStats();
      let semapiCalls: number | undefined;
      try {
        const s = await semApiService.getSemApiStats();
        semapiCalls = s.totalCalls;
      } catch {}
      let dbType: string | undefined;
      try {
        dbType = getDb().type;
      } catch {}
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(metricsService.renderPrometheus({
        cacheEntries: cacheStats.memoryEntries,
        cacheHitRate: cacheStats.hitRate,
        semapiCalls,
        dbType,
      }));
    } catch {
      res.status(500).send('# semar metrics unavailable\n');
    }
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/setup', setupRoutes);
  app.use('/api/v1/nodes', nodesRoutes);
  app.use('/api/v1/lyrics', lyricsRoutes);
  app.use('/api/v1/cache', cacheRoutes);
  app.use('/api/v1/submissions', submissionsRoutes);
  app.use('/api/admin/submissions', submissionsRoutes);
  app.use('/api/minai', minaiRoutes);
  app.use('/api/semapi', semapiRoutes);
  app.use('/api/admin/database', databaseRoutes);
  app.use('/api/admin/stats', statsRoutes);
  app.use('/api/admin/logs', logsRoutes);
  app.use('/api/admin/security', securityRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/admin/settings', settingsRoutes);
  app.use('/api/pages', pagesRoutes);
  app.use('/api/admin/pages', pagesRoutes);

  // Serve Client Static Files if built
  const clientDistPath = path.resolve(__dirname, '../../dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(clientDistPath, 'index.html'));
      }
      next();
    });
  }

  // Error Handler
  app.use(errorHandler);

  return app;
}
