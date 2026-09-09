import type { Request, Response, NextFunction } from 'express';

const ipLimits = new Map<string, { count: number; resetAt: number }>();

export function globalRateLimiter(limitRpm: number = 240) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = ipLimits.get(ip);

    if (record) {
      if (now < record.resetAt) {
        if (record.count >= limitRpm) {
          return res.status(429).json({
            error: 'Too Many Requests',
            message: `Global rate limit of ${limitRpm} requests/min exceeded.`,
            retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
          });
        }
        record.count++;
      } else {
        ipLimits.set(ip, { count: 1, resetAt: now + 60000 });
      }
    } else {
      ipLimits.set(ip, { count: 1, resetAt: now + 60000 });
    }

    next();
  };
}
