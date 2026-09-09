import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Semar Server Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the Semar engine.',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
