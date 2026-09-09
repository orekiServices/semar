import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/server/app.js';
import { initDatabase } from '../src/server/db/index.js';

let appInstance: any = null;
let dbInitialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!dbInitialized) {
    await initDatabase(true);
    dbInitialized = true;
  }

  if (!appInstance) {
    appInstance = createApp();
  }

  return appInstance(req, res);
}
