import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: any;
  apiKey?: any;
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
      req.apiKey = validated;
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Valid API Key or Admin Session required' });
}
