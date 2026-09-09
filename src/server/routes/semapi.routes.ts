import { Router } from 'express';
import { semApiService } from '../services/semapi.service.js';
import { authService } from '../services/auth.service.js';
import { requireAdminAuth } from '../middleware/auth.middleware.js';
import { logsService } from '../services/logs.service.js';

const router = Router();

// 1. Management API (Admin Protected)
router.get('/routes', requireAdminAuth, async (req, res, next) => {
  try {
    const routes = await semApiService.listRoutes();
    res.json({ status: 'success', count: routes.length, routes });
  } catch (err) {
    next(err);
  }
});

router.get('/routes/public', async (req, res, next) => {
  try {
    const routes = await semApiService.listRoutes();
    // Return sanitized route docs for public/documentation
    const docs = routes.filter((r) => r.enabled).map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      method: r.method,
      auth_required: r.auth_required,
      api_key_header: r.api_key_header,
      rate_limit_rpm: r.rate_limit_rpm,
      request_schema: r.request_schema,
      response_schema: r.response_schema,
      description: r.description,
      tags: r.tags,
      total_calls: r.total_calls,
    }));
    res.json({ status: 'success', routes: docs });
  } catch (err) {
    next(err);
  }
});

router.get('/routes/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const route = await semApiService.getRoute(req.params.id);
    if (!route) {
      return res.status(404).json({ error: `Route "${req.params.id}" not found` });
    }
    res.json({ status: 'success', route });
  } catch (err) {
    next(err);
  }
});

router.post('/routes', requireAdminAuth, async (req, res, next) => {
  try {
    const created = await semApiService.createRoute(req.body);
    await logsService.recordAudit('SEMAPI_ROUTE_CREATED', (req as any).user?.username, { routeId: created.id, path: created.path }, req.ip);
    res.status(201).json({ status: 'success', route: created });
  } catch (err) {
    next(err);
  }
});

router.put('/routes/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const updated = await semApiService.updateRoute(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: `Route "${req.params.id}" not found` });
    }
    await logsService.recordAudit('SEMAPI_ROUTE_UPDATED', (req as any).user?.username, { routeId: req.params.id }, req.ip);
    res.json({ status: 'success', route: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/routes/:id', requireAdminAuth, async (req, res, next) => {
  try {
    await semApiService.deleteRoute(req.params.id);
    await logsService.recordAudit('SEMAPI_ROUTE_DELETED', (req as any).user?.username, { routeId: req.params.id }, req.ip);
    res.json({ status: 'success', message: 'Route deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/routes/:id/toggle', requireAdminAuth, async (req, res, next) => {
  try {
    const { enabled } = req.body;
    await semApiService.toggleRoute(req.params.id, Boolean(enabled));
    res.json({ status: 'success', id: req.params.id, enabled: Boolean(enabled) });
  } catch (err) {
    next(err);
  }
});

// Interactive Web-Panel Tester
router.post('/test/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await semApiService.testRoute(req.params.id, req.body);
    res.json({
      status: 'success',
      execution: result,
    });
  } catch (err) {
    next(err);
  }
});

// Logs & stats
router.get('/logs', requireAdminAuth, async (req, res, next) => {
  try {
    const routeId = req.query.routeId as string;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const logs = await semApiService.getRouteLogs(routeId, limit);
    res.json({ status: 'success', count: logs.length, logs });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await semApiService.getSemApiStats();
    res.json({ status: 'success', stats });
  } catch (err) {
    next(err);
  }
});

// 2. Dynamic Execution Dispatcher (Handles all methods and subpaths on /api/semapi/run/...)
router.use('/run', async (req, res, next) => {
  try {
    let rawPath = req.url.split('?')[0];
    if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;
    const method = req.method;

    // Look for matching registered route
    const route = await semApiService.findMatchingRoute(rawPath, method);
    if (!route) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No active SemAPI route registered for "${method} ${rawPath}"`,
      });
    }

    // Check Auth if route requires auth
    if (route.auth_required) {
      const headerKeyName = (route.api_key_header || 'X-SemAPI-Key').toLowerCase();
      const apiKeyVal = (req.headers[headerKeyName] || req.headers['authorization']?.replace('Bearer ', '')) as string;

      if (!apiKeyVal) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: `This SemAPI route requires authentication via "${route.api_key_header}" header.`,
        });
      }

      const valid = await authService.validateApiKey(apiKeyVal);
      if (!valid) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid or revoked API Key',
        });
      }
    }

    const params = semApiService.extractParams(route.path, rawPath);

    const result = await semApiService.executeRouteCode(route, {
      params,
      query: req.query,
      body: req.body,
      headers: req.headers as Record<string, string>,
      method,
      ip: req.ip || req.socket.remoteAddress,
    });

    for (const [header, val] of Object.entries(result.headers)) {
      res.setHeader(header, val);
    }

    res.status(result.statusCode).send(result.body);
  } catch (err) {
    next(err);
  }
});

export default router;
