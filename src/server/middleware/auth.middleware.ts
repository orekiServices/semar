import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { getDb } from '../db/index.js';

export interface AuthenticatedRequest extends Request {
  user?: any;
  apiKey?: any;
}

// v2.1 — Per-API-key rate limit buckets (key id -> window)
const apiKeyLimits = new Map<string, { count: number; resetAt: number }>();

// v2.1 — Cached public-search policy (refreshed every 60s to avoid DB hit per request)
let searchPolicyCache: { requireApiKey: boolean; fetchedAt: number } = { requireApiKey: false, fetchedAt: 0 };

export async function isSearchKeyRequired(): Promise<boolean> {
  const now = Date.now();
  if (now - searchPolicyCache.fetchedAt < 60000) {
    return searchPolicyCache.requireApiKey;
  }
  try {
    const db = getDb();
    const row = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', ['system_settings']);
    let required = false;
    if (row) {
      const val = typeof row.value === 'string' ? JSON.parse(row.value || '{}') : row.value;
      required = Boolean(val?.requireApiKeyForSearch);
    }
    searchPolicyCache = { requireApiKey: required, fetchedAt: now };
    return required;
  } catch {
    return searchPolicyCache.requireApiKey;
  }
}

/** Test helper: clear cached policy + rate buckets. */
export function _resetAuthCaches(): void {
  searchPolicyCache = { requireApiKey: false, fetchedAt: 0 };
  apiKeyLimits.clear();
}

function checkApiKeyRateLimit(keyId: string, rpm: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = apiKeyLimits.get(keyId);
  if (record) {
    if (now < record.resetAt) {
      if (record.count >= rpm) {
        return { allowed: false, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) };
      }
      record.count++;
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
  apiKeyLimits.set(keyId, { count: 1, resetAt: now + 60000 });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

export async function requireApiKeyOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // 1. Check Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  // 2. Check X-SemAPI-Key or X-API-Key header or query key
  const apiKeyRaw = (req.headers['x-semapi-key'] || req.headers['x-api-key'] || req.query.apiKey) as string;
  if (apiKeyRaw) {
    const validated = await authService.validateApiKey(apiKeyRaw);
    if (validated) {
      // v2.1: enforce per-key rate limit
      const rl = checkApiKeyRateLimit(validated.id, validated.rate_limit_rpm || 120);
      if (!rl.allowed) {
        return res.status(429).json({
          error: 'API key rate limit exceeded',
          message: `Key "${validated.name}" exceeded ${validated.rate_limit_rpm} requests/min.`,
          retryAfterSeconds: rl.retryAfterSeconds,
        });
      }
      req.apiKey = validated;
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Valid API Key or Admin Session required' });
}

/**
 * v2.1 — Attach API-key identity to public routes when a key is presented.
 * Always enforces the key's own rate limit + permission/node restrictions.
 * When `system_settings.requireApiKeyForSearch` is enabled, a valid key
 * (or admin session) becomes mandatory.
 */
export async function trackApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Admin bearer sessions bypass everything
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  const apiKeyRaw = (req.headers['x-semapi-key'] || req.headers['x-api-key'] || req.query.apiKey) as string;
  if (apiKeyRaw) {
    const validated = await authService.validateApiKey(apiKeyRaw);
    if (!validated) {
      return res.status(403).json({ error: 'Forbidden: Invalid or revoked API key' });
    }
    const rl = checkApiKeyRateLimit(validated.id, validated.rate_limit_rpm || 120);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'API key rate limit exceeded',
        message: `Key "${validated.name}" exceeded ${validated.rate_limit_rpm} requests/min.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
    }
    req.apiKey = validated;
    return next();
  }

  // No key presented — check whether policy requires one
  if (await isSearchKeyRequired()) {
    return res.status(401).json({
      error: 'Unauthorized: This instance requires an API key for lyrics search',
      hint: 'Send your key via X-API-Key header, X-SemAPI-Key header, or ?apiKey= query parameter.',
    });
  }

  next();
}
