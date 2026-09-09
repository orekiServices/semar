import bcrypt from 'bcryptjs';
import type { DatabaseAdapter } from './adapter.js';

/**
 * v2.2 — Minimal seed. No default nodes, no sample lyrics: fresh installs
 * start empty and admins provision their own nodes. External libraries
 * (LRCLIB etc.) are always available as special nodes, so search works
 * out of the box without local data.
 *
 * Seeds only: default admin + master API key + starter SemAPI routes.
 */
export async function seedDatabase(db: DatabaseAdapter, forceAdmin: boolean = false): Promise<void> {
  const stringify = (val: any) => {
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  };

  // 1. Default admin user + master API key (if none exist)
  const adminCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM admin_users');
  if (!adminCount || Number(adminCount.count) === 0 || forceAdmin) {
    const defaultPassHash = await bcrypt.hash('admin123456', 10);
    const masterApiKey = 'semar_master_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    await db.execute(
      `INSERT INTO admin_users (username, password_hash, role, api_key) VALUES (?, ?, ?, ?)`,
      ['admin', defaultPassHash, 'superadmin', masterApiKey]
    );

    const keyHash = await bcrypt.hash(masterApiKey, 10);
    const existingKey = await db.queryOne('SELECT id FROM api_keys WHERE id = ?', ['key-master-001']);
    if (!existingKey) {
      await db.execute(
        `INSERT INTO api_keys (id, key_hash, key_prefix, name, permissions, rate_limit_rpm)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'key-master-001',
          keyHash,
          masterApiKey.substring(0, 12) + '...',
          'Master System API Key',
          stringify(['admin', 'read', 'write', 'semapi:execute', 'curator:write']),
          1000,
        ]
      );
    }
  }

  // 2. Starter SemAPI routes (idempotent per-route)
  const defaultSemApiRoutes = [
    {
      id: 'route-fast-anime',
      name: 'Fast Anime Search',
      path: '/v1/anime/search',
      method: 'GET',
      description: 'Cross-node anime & J-Pop lyrics search (works with whatever nodes you create).',
      tags: ['Anime', 'Search'],
      code: `async function handler(ctx) {
  const q = (ctx.query.q || '').toString();
  const limit = Math.min(parseInt(ctx.query.limit || '10', 10), 50);
  ctx.log('Fast anime search:', q);
  const results = await ctx.lyrics.searchAll(q, limit);
  return ctx.json({ status: 'success', query: q, count: results.length, results });
}`,
    },
    {
      id: 'route-global-search',
      name: 'Global Lyrics Search',
      path: '/v1/search',
      method: 'GET',
      description: 'Cross-node lyrics search across all active local partitions.',
      tags: ['Search', 'Global'],
      code: `async function handler(ctx) {
  const q = (ctx.query.q || '').toString();
  const limit = Math.min(parseInt(ctx.query.limit || '20', 10), 100);
  const results = await ctx.lyrics.searchAll(q, limit);
  return ctx.json({ status: 'success', query: q, count: results.length, results });
}`,
    },
    {
      id: 'route-youtube-resolve',
      name: 'YouTube ID Resolver',
      path: '/v1/resolve/youtube/:videoId',
      method: 'GET',
      description: 'Resolve synchronized lyrics directly from a YouTube Video ID via the cache pipeline.',
      tags: ['YouTube', 'Cache'],
      code: `async function handler(ctx) {
  const videoId = (ctx.params.videoId || '').toString();
  if (!videoId) return ctx.error('videoId path parameter is required', 400);
  const lyrics = await ctx.lyrics.getByYouTubeId(videoId);
  if (!lyrics) return ctx.error('No lyrics cached for YouTube ID ' + videoId, 404);
  return ctx.json({ status: 'success', source: 'youtube_lyrics_cache', videoId, lyrics });
}`,
    },
    {
      id: 'route-minai-generate',
      name: 'MIN-AI Lyric Generator',
      path: '/v1/ai/generate',
      method: 'POST',
      description: 'Generate original lyric lines with the MIN-AI Markov engine trained on your catalog.',
      tags: ['MIN-AI', 'AI'],
      code: `async function handler(ctx) {
  const { seed, lines, artist } = ctx.body || {};
  const result = await ctx.minai.generate({ seed, lines: lines || 8, artist });
  return ctx.json({ status: 'success', ...result });
}`,
    },
  ];

  for (const route of defaultSemApiRoutes) {
    const existing = await db.queryOne('SELECT id FROM semapi_routes WHERE id = ?', [route.id]);
    if (!existing) {
      await db.execute(
        `INSERT INTO semapi_routes (id, name, path, method, enabled, auth_required, api_key_header, rate_limit_rpm, permissions, request_schema, response_schema, code, default_response, description, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          route.id,
          route.name,
          route.path,
          route.method,
          true,
          false,
          'X-SemAPI-Key',
          120,
          stringify([]),
          stringify({}),
          stringify({}),
          route.code,
          stringify({ status: 'ok' }),
          route.description,
          stringify(route.tags),
        ]
      );
    }
  }
}
