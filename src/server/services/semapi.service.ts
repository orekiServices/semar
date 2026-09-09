import vm from 'vm';
import { getDb } from '../db/index.js';
import { nodeService } from './node.service.js';
import { lyricsService } from './lyrics.service.js';
import { cacheService } from './cache.service.js';
import { lrcToTtml, ttmlToLrc } from './ttml.util.js';
import { minaiService } from './minai.service.js';

export interface SemApiRoute {
  id: string;
  name: string;
  path: string;
  method: string;
  enabled: boolean;
  auth_required: boolean;
  api_key_header: string;
  rate_limit_rpm: number;
  permissions: string[];
  request_schema: any;
  response_schema: any;
  code: string;
  default_response: any;
  description?: string;
  tags: string[];
  total_calls: number;
  last_called_at?: string;
  last_status?: number;
  error_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SemApiExecutionResult {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  latencyMs: number;
  logs: string[];
  error?: string;
}

export class SemApiService {
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();

  async listRoutes(): Promise<SemApiRoute[]> {
    const db = getDb();
    const rows = await db.query<any>('SELECT * FROM semapi_routes ORDER BY created_at ASC');
    return rows.map(this.formatRoute);
  }

  async getRoute(id: string): Promise<SemApiRoute | null> {
    const db = getDb();
    const row = await db.queryOne<any>('SELECT * FROM semapi_routes WHERE id = ?', [id]);
    return row ? this.formatRoute(row) : null;
  }

  async findMatchingRoute(path: string, method: string): Promise<SemApiRoute | null> {
    const db = getDb();
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const cleanMethod = method.toUpperCase();

    // Exact match or wildcard match
    const rows = await db.query<any>(
      `SELECT * FROM semapi_routes 
       WHERE enabled = ? AND (method = ? OR method = 'ALL')`,
      [true, cleanMethod]
    );

    for (const r of rows) {
      const routePath = r.path.startsWith('/') ? r.path : '/' + r.path;
      if (this.matchPath(routePath, cleanPath)) {
        return this.formatRoute(r);
      }
    }

    return null;
  }

  private matchPath(pattern: string, actual: string): boolean {
    if (pattern === actual) return true;
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);

    if (patternParts.length !== actualParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) continue; // param wildcard
      if (patternParts[i] !== actualParts[i]) return false;
    }
    return true;
  }

  extractParams(pattern: string, actual: string): Record<string, string> {
    const params: Record<string, string> = {};
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].substring(1);
        params[paramName] = actualParts[i] || '';
      }
    }
    return params;
  }

  private formatRoute(r: any): SemApiRoute {
    return {
      ...r,
      enabled: Boolean(r.enabled),
      auth_required: Boolean(r.auth_required),
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions || [],
      request_schema: typeof r.request_schema === 'string' ? JSON.parse(r.request_schema || '{}') : r.request_schema || {},
      response_schema: typeof r.response_schema === 'string' ? JSON.parse(r.response_schema || '{}') : r.response_schema || {},
      default_response: typeof r.default_response === 'string' ? JSON.parse(r.default_response || '{}') : r.default_response || {},
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : r.tags || [],
      total_calls: Number(r.total_calls || 0),
      error_count: Number(r.error_count || 0),
    };
  }

  async createRoute(data: Partial<SemApiRoute>): Promise<SemApiRoute> {
    const db = getDb();
    const id = data.id || 'route-' + Math.random().toString(36).substring(2, 9);

    const stringify = (val: any) => typeof val === 'object' ? JSON.stringify(val) : val;

    await db.execute(
      `INSERT INTO semapi_routes (id, name, path, method, enabled, auth_required, api_key_header, rate_limit_rpm, permissions, request_schema, response_schema, code, default_response, description, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name || 'Custom Dynamic Route',
        data.path || '/v1/custom/endpoint',
        (data.method || 'GET').toUpperCase(),
        data.enabled !== false,
        Boolean(data.auth_required),
        data.api_key_header || 'X-SemAPI-Key',
        data.rate_limit_rpm || 60,
        stringify(data.permissions || []),
        stringify(data.request_schema || {}),
        stringify(data.response_schema || {}),
        data.code || `async function handler(ctx) {\n  return ctx.json({ message: "Hello from SemAPI!" });\n}`,
        stringify(data.default_response || { status: 'ok' }),
        data.description || '',
        stringify(data.tags || ['Custom']),
      ]
    );

    return (await this.getRoute(id))!;
  }

  async updateRoute(id: string, data: Partial<SemApiRoute>): Promise<SemApiRoute | null> {
    const db = getDb();
    const existing = await this.getRoute(id);
    if (!existing) return null;
    const stringify = (val: any) => typeof val === 'object' ? JSON.stringify(val) : val;

    await db.execute(
      `UPDATE semapi_routes 
       SET name = ?, path = ?, method = ?, enabled = ?, auth_required = ?, api_key_header = ?, rate_limit_rpm = ?, permissions = ?, request_schema = ?, response_schema = ?, code = ?, default_response = ?, description = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name !== undefined ? data.name : existing.name,
        data.path !== undefined ? data.path : existing.path,
        data.method !== undefined ? data.method.toUpperCase() : existing.method,
        data.enabled !== undefined ? (Boolean(data.enabled)) : (Boolean(existing.enabled)),
        data.auth_required !== undefined ? (Boolean(data.auth_required)) : (Boolean(existing.auth_required)),
        data.api_key_header !== undefined ? data.api_key_header : existing.api_key_header,
        data.rate_limit_rpm !== undefined ? data.rate_limit_rpm : existing.rate_limit_rpm,
        data.permissions !== undefined ? stringify(data.permissions) : JSON.stringify(existing.permissions),
        data.request_schema !== undefined ? stringify(data.request_schema) : JSON.stringify(existing.request_schema),
        data.response_schema !== undefined ? stringify(data.response_schema) : JSON.stringify(existing.response_schema),
        data.code !== undefined ? data.code : existing.code,
        data.default_response !== undefined ? stringify(data.default_response) : JSON.stringify(existing.default_response),
        data.description !== undefined ? data.description : existing.description,
        data.tags !== undefined ? stringify(data.tags) : JSON.stringify(existing.tags),
        id,
      ]
    );

    return await this.getRoute(id);
  }

  async deleteRoute(id: string): Promise<boolean> {
    const db = getDb();
    await db.execute('DELETE FROM semapi_routes WHERE id = ?', [id]);
    await db.execute('DELETE FROM semapi_logs WHERE route_id = ?', [id]);
    return true;
  }

  async toggleRoute(id: string, enabled: boolean): Promise<boolean> {
    const db = getDb();
    await db.execute(
      'UPDATE semapi_routes SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Boolean(enabled), id]
    );
    return true;
  }

  /**
   * v2.1 — Export a route as a portable JSON bundle (code + config, no stats).
   */
  async exportRoute(id: string): Promise<{ exportedAt: string; semarVersion: string; route: any } | null> {
    const route = await this.getRoute(id);
    if (!route) return null;
    const {
      total_calls, last_called_at, last_status, error_count, created_at, updated_at, ...portable
    } = route as any;
    return {
      exportedAt: new Date().toISOString(),
      semarVersion: '2.2.0',
      route: portable,
    };
  }

  /**
   * v2.1 — Import one or many exported route bundles. ID collisions get a
   * fresh unique id so imports never overwrite existing routes by accident.
   */
  async importRoutes(payload: any): Promise<SemApiRoute[]> {
    const bundles: any[] = [];
    if (Array.isArray(payload)) {
      for (const item of payload) bundles.push(item?.route || item);
    } else if (payload?.routes && Array.isArray(payload.routes)) {
      for (const item of payload.routes) bundles.push(item?.route || item);
    } else if (payload?.route) {
      bundles.push(payload.route);
    } else if (payload?.path && payload?.code) {
      bundles.push(payload);
    }

    if (bundles.length === 0) {
      throw Object.assign(new Error('No importable SemAPI routes found in payload'), { statusCode: 400 });
    }

    const created: SemApiRoute[] = [];
    for (const b of bundles) {
      if (!b.path || !b.code) continue;
      let id = typeof b.id === 'string' && b.id.trim() ? b.id.trim() : undefined;
      if (id && (await this.getRoute(id))) {
        id = `${id}-import-${Math.random().toString(36).substring(2, 7)}`;
      }
      const route = await this.createRoute({ ...b, id });
      created.push(route);
    }

    if (created.length === 0) {
      throw Object.assign(new Error('No valid routes to import (each needs path + code)'), { statusCode: 400 });
    }
    return created;
  }

  // Real server-side JavaScript execution engine
  async executeRouteCode(
    route: SemApiRoute,
    reqData: {
      params?: Record<string, string>;
      query?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
      method?: string;
      ip?: string;
    }
  ): Promise<SemApiExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    let statusCode = 200;
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Powered-By': 'SemAPI/2.0',
      'X-SemAPI-Route': route.id,
    };
    let responseBody: any = null;
    let isError = false;
    let errorMessage: string | undefined = undefined;

    // Check Route Rate Limit
    const clientIp = reqData.ip || '127.0.0.1';
    const rateLimitKey = `${route.id}:${clientIp}`;
    const now = Date.now();
    const rateLimitRecord = this.rateLimiters.get(rateLimitKey);

    if (rateLimitRecord) {
      if (now < rateLimitRecord.resetTime) {
        if (rateLimitRecord.count >= route.rate_limit_rpm) {
          return {
            statusCode: 429,
            headers: responseHeaders,
            body: { error: 'SemAPI Rate limit exceeded. Try again later.', retryAfter: Math.ceil((rateLimitRecord.resetTime - now) / 1000) },
            latencyMs: Date.now() - startTime,
            logs: [`Rate limit hit: ${rateLimitRecord.count}/${route.rate_limit_rpm} rpm`],
            error: 'Rate limit exceeded',
          };
        }
        rateLimitRecord.count++;
      } else {
        this.rateLimiters.set(rateLimitKey, { count: 1, resetTime: now + 60000 });
      }
    } else {
      this.rateLimiters.set(rateLimitKey, { count: 1, resetTime: now + 60000 });
    }

    const db = getDb();

    // Context definition for sandboxed user JS execution
    const ctx = {
      params: reqData.params || {},
      query: reqData.query || {},
      body: reqData.body || {},
      headers: reqData.headers || {},
      method: (reqData.method || route.method).toUpperCase(),
      ip: clientIp,
      db: {
        query: async (sql: string, params?: any[]) => db.query(sql, params),
        queryOne: async (sql: string, params?: any[]) => db.queryOne(sql, params),
        execute: async (sql: string, params?: any[]) => db.execute(sql, params),
      },
      nodes: {
        list: async () => nodeService.listNodes(),
        get: async (nodeId: string) => nodeService.getNode(nodeId),
        searchLyrics: async (nodeId: string, q: string, limit?: number) => lyricsService.searchNode(nodeId, q, limit),
        getLyrics: async (nodeId: string, id: number) => lyricsService.getLyricsById(nodeId, id),
      },
      lyrics: {
        searchAll: async (q: string, limit?: number) => lyricsService.searchAll(q, limit),
        getByYouTubeId: async (ytId: string) => lyricsService.getByYouTubeId(ytId),
        saveLyrics: async (nodeId: string, data: any) => lyricsService.saveLyrics(nodeId, data),
        lrcToTtml: (lrc: string, title?: string, artist?: string, dur?: number) => lrcToTtml(lrc, title, artist, dur),
        ttmlToLrc: (ttml: string) => ttmlToLrc(ttml),
      },
      cache: {
        get: async (key: string) => cacheService.get(key),
        set: async (key: string, val: any, ttlMs?: number) => cacheService.set(key, val, ttlMs),
        delete: async (key: string) => cacheService.delete(key),
      },
      minai: {
        generate: async (opts?: any) => minaiService.generate(opts || {}),
        finder: async (q: string, limit?: number) => minaiService.finder(q, limit),
        similar: async (nodeId: string, id: number | string, limit?: number) => minaiService.similar(nodeId, id, limit),
        status: async () => minaiService.getStatus(),
      },
      fetch: globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        SEMAR_VERSION: '2.2.0',
      },
      log: (...args: any[]) => {
        const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        logs.push(line);
      },
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
        return ctx;
      },
      status: (code: number) => {
        statusCode = code;
        return ctx;
      },
      json: (data: any) => {
        responseBody = data;
        responseHeaders['Content-Type'] = 'application/json';
        return ctx;
      },
      send: (text: string) => {
        responseBody = text;
        responseHeaders['Content-Type'] = 'text/plain';
        return ctx;
      },
      error: (msg: string, code: number = 400) => {
        statusCode = code;
        isError = true;
        errorMessage = msg;
        responseBody = { error: msg, statusCode: code };
        return ctx;
      },
    };

    try {
      // Build executable script wrapped in async function
      const wrappedCode = `
        (async () => {
          ${route.code}
          if (typeof handler === 'function') {
            return await handler(ctx);
          } else {
            throw new Error("SemAPI route code must declare an 'async function handler(ctx)'");
          }
        })()
      `;

      const sandbox = {
        ctx,
        console: {
          log: ctx.log,
          warn: ctx.log,
          error: ctx.log,
          info: ctx.log,
        },
        JSON,
        Math,
        Date,
        RegExp,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Promise,
        Buffer,
        encodeURIComponent,
        decodeURIComponent,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
      };

      const vmContext = vm.createContext(sandbox);
      const script = new vm.Script(wrappedCode, {
        filename: `semapi-${route.id}.js`,
      });

      // Execute with 10s timeout
      const resultPromise = script.runInContext(vmContext, { timeout: 10000 });
      await resultPromise;

      if (responseBody === null) {
        responseBody = route.default_response || { status: 'ok' };
      }
    } catch (err: any) {
      isError = true;
      statusCode = statusCode === 200 ? 500 : statusCode;
      errorMessage = err.message || 'Execution error';
      logs.push(`[ERROR] ${err.stack || err.message}`);
      responseBody = {
        error: 'SemAPI execution failed',
        message: err.message,
        statusCode,
      };
    }

    const latencyMs = Date.now() - startTime;

    // Record route statistics asynchronously
    this.recordRouteStats(route.id, statusCode, isError, latencyMs, reqData, responseBody, logs, errorMessage).catch(() => {});

    return {
      statusCode,
      headers: responseHeaders,
      body: responseBody,
      latencyMs,
      logs,
      error: errorMessage,
    };
  }

  private async recordRouteStats(
    routeId: string,
    status: number,
    isError: boolean,
    latencyMs: number,
    reqData: any,
    responseBody: any,
    logs: string[],
    error?: string
  ): Promise<void> {
    const db = getDb();

    // 1. Update route counters
    await db.execute(
      `UPDATE semapi_routes 
       SET total_calls = total_calls + 1,
           last_called_at = CURRENT_TIMESTAMP,
           last_status = ?,
           error_count = error_count + ${isError ? 1 : 0}
       WHERE id = ?`,
      [status, routeId]
    );

    // 2. Insert execution log
    const respPreview = typeof responseBody === 'object' ? JSON.stringify(responseBody).slice(0, 500) : String(responseBody).slice(0, 500);
    const headersStr = JSON.stringify(reqData.headers || {});
    const bodyStr = JSON.stringify(reqData.body || {});
    const logsStr = JSON.stringify(logs);

    await db.execute(
      `INSERT INTO semapi_logs (route_id, method, path, status_code, latency_ms, ip, request_headers, request_body, response_preview, log_messages, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        routeId,
        reqData.method || 'GET',
        reqData.params ? JSON.stringify(reqData.params) : '/',
        status,
        latencyMs,
        reqData.ip || '127.0.0.1',
        headersStr,
        bodyStr,
        respPreview,
        logsStr,
        error || null,
      ]
    );
  }

  async testRoute(routeId: string, testPayload: {
    method?: string;
    path?: string;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
  }): Promise<SemApiExecutionResult> {
    const route = await this.getRoute(routeId);
    if (!route) {
      return {
        statusCode: 404,
        headers: {},
        body: { error: `Route "${routeId}" not found` },
        latencyMs: 0,
        logs: ['Route not found'],
        error: 'Route not found',
      };
    }

    return await this.executeRouteCode(route, {
      method: testPayload.method || route.method,
      query: testPayload.query || {},
      headers: testPayload.headers || {},
      body: testPayload.body || {},
      params: testPayload.params || this.extractParams(route.path, testPayload.path || route.path),
      ip: '127.0.0.1 (Web Panel Test)',
    });
  }

  async getRouteLogs(routeId?: string, limit: number = 50): Promise<any[]> {
    const db = getDb();
    let sql = 'SELECT * FROM semapi_logs';
    const params: any[] = [];
    if (routeId) {
      sql += ' WHERE route_id = ?';
      params.push(routeId);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await db.query<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      request_headers: typeof r.request_headers === 'string' ? JSON.parse(r.request_headers || '{}') : r.request_headers,
      request_body: typeof r.request_body === 'string' ? JSON.parse(r.request_body || '{}') : r.request_body,
      log_messages: typeof r.log_messages === 'string' ? JSON.parse(r.log_messages || '[]') : r.log_messages,
    }));
  }

  async getSemApiStats() {
    const db = getDb();
    const routes = await this.listRoutes();
    const totalRoutes = routes.length;
    const activeRoutes = routes.filter((r) => r.enabled).length;
    const totalCalls = routes.reduce((acc, r) => acc + (r.total_calls || 0), 0);
    const totalErrors = routes.reduce((acc, r) => acc + (r.error_count || 0), 0);

    const logsCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM semapi_logs');

    return {
      totalRoutes,
      activeRoutes,
      totalCalls,
      totalErrors,
      errorRate: totalCalls > 0 ? parseFloat(((totalErrors / totalCalls) * 100).toFixed(2)) : 0,
      totalLogsRecorded: Number(logsCount?.count) || 0,
    };
  }
}

export const semApiService = new SemApiService();
