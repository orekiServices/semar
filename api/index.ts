import { createApp } from '../src/server/app.js';
import { initDatabase } from '../src/server/db/index.js';

let appInstance: any = null;
let dbInitialized = false;

/**
 * v2.2 — Vercel serverless entry. Returns a clear JSON error when the
 * database is not configured instead of crashing the function.
 */
export default async function handler(req: any, res: any) {
  try {
    if (!dbInitialized) {
      await initDatabase(true);
      dbInitialized = true;
    }

    if (!appInstance) {
      appInstance = createApp();
    }

    return appInstance(req, res);
  } catch (err: any) {
    const message = err?.message || 'Server initialization failed';
    const status = /No database configured/i.test(message) ? 503 : 500;
    res.status(status).json({
      error: status === 503 ? 'Database not configured' : 'Internal Server Error',
      message,
      hint:
        status === 503
          ? 'Set POSTGRES_URL in your Vercel project environment variables (e.g. Neon, Supabase, or Vercel Postgres), then redeploy.'
          : undefined,
    });
  }
}
