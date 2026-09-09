import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { initDatabase, getDb, switchDatabase } from '../src/server/db/index.js';
import { nodeService } from '../src/server/services/node.service.js';
import { lyricsService } from '../src/server/services/lyrics.service.js';
import { cacheService } from '../src/server/services/cache.service.js';
import { semApiService } from '../src/server/services/semapi.service.js';
import { authService } from '../src/server/services/auth.service.js';
import { createApp } from '../src/server/app.js';

import { lrcToTtml, ttmlToLrc, parseLrcTimestamps } from '../src/server/services/ttml.util.js';

describe('Semar Core & Database Isolation Test Suite', () => {
  before(async () => {
    await initDatabase(true);
  });

  test('Database layer initializes with correct dialect', async () => {
    const db = getDb();
    assert.ok(db, 'Database adapter should be defined');
    assert.ok(['sqlite', 'postgres', 'mysql'].includes(db.type), 'Valid db type');
    const testResult = await db.testConnection();
    assert.strictEqual(testResult.success, true, 'Connection test should succeed');
  });

  test('Semar Nodes - default isolated partitions exist (Akai, PiNE, PAKAI)', async () => {
    const nodes = await nodeService.listNodes();
    assert.ok(nodes.length >= 3, 'At least 3 nodes should exist');
    
    const akai = nodes.find(n => n.node_id === 'akai');
    const pine = nodes.find(n => n.node_id === 'pine');
    const pakai = nodes.find(n => n.node_id === 'pakai');

    assert.ok(akai, 'Akai node must exist');
    assert.ok(pine, 'PiNE node must exist');
    assert.ok(pakai, 'PAKAI node must exist');

    assert.strictEqual(akai.table_name, 'lyrics_akai');
    assert.strictEqual(pine.table_name, 'lyrics_pine');
    assert.strictEqual(pakai.table_name, 'lyrics_pakai');
    assert.strictEqual(pakai.is_nsfw, true, 'PAKAI node must be marked as NSFW');
  });

  test('Semar Nodes - provisioning a new isolated node partition', async () => {
    const testNodeId = 'kpoptest_' + Math.random().toString(36).substring(2, 7);
    const created = await nodeService.createNode({
      node_id: testNodeId,
      name: 'K-Pop Test Partition',
      description: 'Isolated test partition for K-Pop tracks',
      storage_mode: 'isolated_table',
      rate_limit: 150,
      total_records_approx: 45000,
      is_nsfw: false,
    });

    assert.strictEqual(created.node_id, testNodeId);
    assert.strictEqual(created.table_name, `lyrics_${testNodeId}`);

    // Insert lyrics specifically into this isolated node
    const insertRes = await lyricsService.saveLyrics(testNodeId, {
      title: 'Hype Boy',
      artist: 'NewJeans',
      album: 'New Jeans 1st EP',
      youtube_video_id: '11cta61Wi0g',
      duration: 179,
      synced_lyrics: '[00:00.00] NewJeans - Hype Boy\n[00:03.20] (1, 2, 3, 4)\n[00:05.10] Baby, got me looking so crazy',
    });

    assert.ok(insertRes.insertId, 'Lyrics should insert successfully');

    // Query node partition specifically
    const tracks = await lyricsService.searchNode(testNodeId, 'Hype Boy');
    assert.strictEqual(tracks.length, 1);
    assert.strictEqual(tracks[0].title, 'Hype Boy');

    // Clean up
    await nodeService.deleteNode(testNodeId);
    const deleted = await nodeService.getNode(testNodeId);
    assert.strictEqual(deleted, null, 'Node should be dropped');
  });

  test('YouTube Video ID Lyrics Cache - resolution pipeline', async () => {
    // 1. Resolve LiSA - Gurenge by YouTube ID CwkzK-Fh400
    const resolved = await lyricsService.getByYouTubeId('CwkzK-Fh400');
    assert.ok(resolved, 'YouTube cache lookup should resolve');
    assert.strictEqual(resolved?.title, 'Gurenge (紅蓮華)');
    assert.strictEqual(resolved?.node_id, 'akai');

    // 2. Query cache service directly
    const cached = await cacheService.getYouTubeCache('CwkzK-Fh400');
    assert.ok(cached, 'Cache entry should be indexed');
    assert.strictEqual(cached?.youtube_video_id, 'CwkzK-Fh400');
    assert.ok(cached.hit_count >= 1, 'Hit count should be incremented');

    // 3. Cache stats verification
    const stats = cacheService.getStats();
    assert.ok(stats.totalHits >= 1, 'Cache hits should be recorded');
  });

  test('SemAPI - dynamic route creation and Node.js VM execution', async () => {
    // Create a dynamic route
    const routeId = 'test-dynamic-calc';
    const createdRoute = await semApiService.createRoute({
      id: routeId,
      name: 'Test Calc Route',
      path: '/v1/test/calc',
      method: 'POST',
      enabled: true,
      auth_required: false,
      rate_limit_rpm: 60,
      code: `async function handler(ctx) {
        const { a, b } = ctx.body || {};
        ctx.log('Executing test addition:', a, b);
        const sum = (Number(a) || 0) + (Number(b) || 0);
        return ctx.json({ result: sum, poweredBy: 'SemAPI VM' });
      }`,
    });

    assert.strictEqual(createdRoute.id, routeId);

    // Test execution
    const testResult = await semApiService.testRoute(routeId, {
      body: { a: 15, b: 27 },
    });

    assert.strictEqual(testResult.statusCode, 200);
    assert.strictEqual(testResult.body.result, 42);
    assert.strictEqual(testResult.body.poweredBy, 'SemAPI VM');
    assert.ok(testResult.logs.length > 0, 'ctx.log() should be captured');

    // Clean up
    await semApiService.deleteRoute(routeId);
  });

  test('SemAPI - query node partitions from inside JavaScript handler', async () => {
    const testExec = await semApiService.testRoute('route-fast-anime', {
      query: { q: 'Idol' },
    });

    assert.strictEqual(testExec.statusCode, 200);
    assert.strictEqual(testExec.body.status, 'success');
    assert.strictEqual(testExec.body.node, 'akai');
    assert.ok(testExec.body.results.some((r: any) => r.title.includes('Idol')));
  });

  test('TTML Conversion - LRC to TTML and TTML to LRC round-trip', async () => {
    const sampleLrc = `[00:04.12]Tsuyoku nareru riyuu wo shitta\n[00:08.85]Boku wo tsurete susume`;
    const ttml = lrcToTtml(sampleLrc, 'Gurenge', 'LiSA', 238);

    assert.ok(ttml.includes('<tt xmlns="http://www.w3.org/ns/ttml"'), 'Should contain TTML root');
    assert.ok(ttml.includes('<ttm:title>Gurenge</ttm:title>'), 'Should contain song title');
    assert.ok(ttml.includes('<ttm:agent type="person" xml:id="v1">LiSA</ttm:agent>'), 'Should contain artist');
    assert.ok(ttml.includes('<span begin="'), 'Should contain word/syllable spans');
    assert.ok(ttml.includes('Tsuyoku'), 'Should contain lyrics words');

    // Parse back to LRC
    const parsedLrc = ttmlToLrc(ttml);
    assert.ok(parsedLrc.includes('[00:04.12]'), 'Parsed LRC should retain timestamps');
    assert.ok(parsedLrc.includes('Tsuyoku nareru riyuu wo shitta'), 'Parsed LRC should retain words');
  });

  test('TTML Lyrics - seeded records have full TTML support in Akai & PiNE', async () => {
    const akaiSong = await lyricsService.getLyricsById('akai', 1);
    assert.ok(akaiSong, 'Akai song 1 should exist');
    assert.ok(akaiSong.ttml_lyrics, 'Akai song 1 should have TTML lyrics populated');
    assert.ok(akaiSong.ttml_lyrics.includes('<tt xmlns="http://www.w3.org/ns/ttml"'));
    assert.ok(akaiSong.ttml_lyrics.includes('<span begin="'));

    const pineSong = await lyricsService.getLyricsById('pine', 1);
    assert.ok(pineSong, 'PiNE song 1 should exist');
    assert.ok(pineSong.ttml_lyrics, 'PiNE song 1 should have TTML lyrics populated');
  });

  test('Auth Service - Admin credentials and API key generation', async () => {
    // Generate an API key
    const gen = await authService.generateApiKey('Bot Key Test', ['read', 'semapi:execute'], ['akai'], 180);
    assert.ok(gen.rawKey.startsWith('semar_key_'));
    assert.strictEqual(gen.keyItem.name, 'Bot Key Test');

    // Validate the API key
    const validated = await authService.validateApiKey(gen.rawKey);
    assert.ok(validated, 'Key should validate');
    assert.strictEqual(validated?.name, 'Bot Key Test');
    assert.strictEqual(validated?.is_active, true);

    // Clean up
    await authService.deleteApiKey(gen.keyItem.id);
  });
});
