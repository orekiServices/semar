import type { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service.js';

/**
 * v2.1 — Records every request into the real metrics engine.
 * Skips the Prometheus scrape endpoint itself to avoid feedback loops.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    try {
      if (req.path === '/api/metrics') return;
      const route = req.baseUrl ? req.baseUrl + req.path : req.path;
      metricsService.recordHit(route || req.path, req.method, res.statusCode, Date.now() - start);
    } catch {
      // metrics must never break requests
    }
  });
  next();
}
