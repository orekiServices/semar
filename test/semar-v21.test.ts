import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { initDatabase, getDb } from '../src/server/db/index.js';
import { nodeService } from '../src/server/services/node.service.js';
import { lyricsService } from '../src/server/services/lyrics.service.js';
import { cacheService } from '../src/server/services/cache.service.js';
import { semApiService } from '../src/server/services/semapi.service.js';
import { authService } from '../src/server/services/auth.service.js';
import { metricsService } from '../src/server/services/metrics.service.js';
import { submissionService } from '../src/server/services/submission.service.js';
import { janitorService } from '../src/server/services/janitor.service.js';

describe('Semar v2.1 Feature Test Suite', () => {
  before(async () => {
    await initDatabase(true);
    metricsService.reset();

    // v2.2: tests provision their own nodes (no seeded defaults)
    for (const nodeId of ['akai', 'pine']) {
      const existing = await nodeService.getNode(nodeId);
      if (!existing) await nodeService.createNode({ node_id: nodeId, name: `${nodeId} test` } as any);
    }
    const trendingSeed = await lyricsService.searchNode('pine', 'V21 Trending Seed');
    if (trendingSeed.length === 0) {
      await lyricsService.saveLyrics('pine', {
        title: 'V21 Trending Seed Alpha',
        artist: 'V21 Band',
        plain_lyrics: 'trending alpha lyrics here',
        views_count: 9000,
      });
      await lyricsService.saveLyrics('pine', {
        title: 'V21 Trending Seed Beta',
        artist: 'V21 Band',
        plain_lyrics: 'trending beta lyrics here',
        views_count: 3000,
      });
      await lyricsService.saveLyrics('akai', {
        title: 'V21 Akai Scoped Track',
        artist: 'V21 Scoped',
        plain_lyrics: 'scoped akai lyrics here',
        views_count: 100,
      });
    }
  });

  test('Metrics engine - records hits and builds a real hourly timeline', async () => {
    metricsService.recordHit('/api/v1/lyrics/search', 'GET', 200, 12);
    metricsService.recordHit('/api/v1/lyrics/search', 'GET', 200, 18);
    metricsService.recordHit('/api/v1/lyrics/youtube/CwkzK-Fh400', 'GET', 200, 5);
    metricsService.recordHit('/api/v1/lyrics/search', 'GET', 500, 30);

    const snap = metricsService.getSnapshot();
    assert.strictEqual(snap.totalRequests, 4);
    assert.strictEqual(snap.totalErrors, 1);
    assert.ok(snap.topRoutes.length > 0, 'top routes should be tracked');
    // YouTube id should be normalized to keep cardinality low
    assert.ok(
      snap.topRoutes.some((r) => r.route.includes('/youtube/:id')),
      'dynamic ids must be normalized, got: ' + JSON.stringify(snap.topRoutes)
    );

    const timeline = metricsService.getHourlyTimeline(24);
    assert.strictEqual(timeline.length, 24);
    const currentHour = timeline[timeline.length - 1];
    assert.strictEqual(currentHour.requests, 4);
    assert.strictEqual(currentHour.errors, 1);
    assert.ok(currentHour.avgLatencyMs > 0);
  });

  test('Metrics engine - Prometheus exposition renders counters', async () => {
    const text = metricsService.renderPrometheus({ cacheEntries: 7, cacheHitRate: 88.5, semapiCalls: 42, dbType: 'pglite' });
    assert.ok(text.includes('semar_http_requests_total 4'));
    assert.ok(text.includes('semar_http_errors_total 1'));
    assert.ok(text.includes('semar_http_status_total{status="200"} 3'));
    assert.ok(text.includes('semar_cache_memory_entries 7'));
    assert.ok(text.includes('semar_semapi_calls_total 42'));
    assert.ok(text.includes('semar_db_info{engine="pglite"} 1'));
  });

  test('Metrics engine - flush persists hourly aggregates to system_metrics', async () => {
    const res = await metricsService.flushToDatabase();
    assert.strictEqual(res.persisted, true);
    assert.ok(res.hours >= 1);
    const db = getDb();
    const row = await db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM system_metrics WHERE category = 'http' AND metric_name = 'requests_per_hour'"
    );
    assert.ok(Number(row?.count) >= 1, 'hourly aggregate rows should exist');
  });

  test('Submissions - full moderation flow: submit -> approve -> searchable', async () => {
    const nodeId = 'subtest_' + Math.random().toString(36).substring(2, 7);
    await nodeService.createNode({ node_id: nodeId, name: 'Submission Test Node' });

    const uniqueTitle = 'V21 Submission Song ' + Math.random().toString(36).substring(2, 8);
    const created = await submissionService.createSubmission({
      node_id: nodeId,
      title: uniqueTitle,
      artist: 'V21 Test Artist',
      plain_lyrics: 'line one\nline two',
      synced_lyrics: '[00:01.00] line one\n[00:05.00] line two',
      submitter_name: 'tester',
      submitter_ip: '10.99.0.1',
    });
    assert.strictEqual(created.status, 'pending');
    assert.strictEqual(created.title, uniqueTitle);

    const pending = await submissionService.listSubmissions({ status: 'pending', search: uniqueTitle });
    assert.ok(pending.items.some((i) => i.id === created.id), 'submission should appear in pending queue');

    const counts = await submissionService.countByStatus();
    assert.ok(counts.pending >= 1);

    // Approve -> must insert into the node partition
    const approved = await submissionService.approveSubmission(created.id, 'test-admin');
    assert.strictEqual(approved.status, 'approved');
    assert.ok(approved.song_id, 'approved submission must reference the new song id');

    const found = await lyricsService.searchNode(nodeId, uniqueTitle);
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].title, uniqueTitle);
    assert.ok(found[0].ttml_lyrics && found[0].ttml_lyrics.includes('<tt'), 'TTML should be auto-generated on approve');

    // Cleanup
    await submissionService.deleteSubmission(created.id);
    await nodeService.deleteNode(nodeId);
    const gone = await submissionService.getById(created.id);
    assert.strictEqual(gone, null);
  });

  test('Submissions - validation rejects empty payloads and unknown nodes', async () => {
    await assert.rejects(
      () => submissionService.createSubmission({ node_id: 'akai', title: '', artist: 'x', plain_lyrics: 'hi' } as any),
      /title is required/
    );
    await assert.rejects(
      () => submissionService.createSubmission({ node_id: 'akai', title: 't', artist: 'a' } as any),
      /At least one lyrics payload/
    );
    await assert.rejects(
      () => submissionService.createSubmission({ node_id: 'nope_missing', title: 't', artist: 'a', plain_lyrics: 'x' } as any),
      /does not exist/
    );
    await assert.rejects(
      () => submissionService.createSubmission({ node_id: 'lrclib', title: 't', artist: 'a', plain_lyrics: 'x' } as any),
      /special external node/
    );
  });

  test('Submissions - reject flow marks submission with reviewer note', async () => {
    const created = await submissionService.createSubmission({
      node_id: 'akai',
      title: 'V21 Reject Me ' + Math.random().toString(36).substring(2, 8),
      artist: 'V21',
      plain_lyrics: 'spam-ish lyrics',
      submitter_ip: '10.99.0.2',
    });
    const rejected = await submissionService.rejectSubmission(created.id, 'test-admin', 'Duplicate of existing track');
    assert.strictEqual(rejected.status, 'rejected');
    assert.strictEqual(rejected.review_note, 'Duplicate of existing track');
    assert.strictEqual(rejected.reviewed_by, 'test-admin');
    await submissionService.deleteSubmission(created.id);
  });

  test('Trending - returns top tracks ordered by views', async () => {
    const trending = await lyricsService.getTrending(5);
    assert.ok(trending.length > 0, 'seeded catalog should produce trending tracks');
    assert.ok(trending.length <= 5);
    for (let i = 1; i < trending.length; i++) {
      assert.ok(
        (trending[i - 1].views_count || 0) >= (trending[i].views_count || 0),
        'trending must be sorted by views_count desc'
      );
    }
    // Second call should hit the 5-min memory cache
    const cached = await lyricsService.getTrending(5);
    assert.deepStrictEqual(cached.map((t) => t.id), trending.map((t) => t.id));
  });

  test('Scoped search - nodeIds restriction filters partitions', async () => {
    const akaiOnly = await lyricsService.searchAll('', 50, { nsfw: true, nodeIds: ['akai'] });
    assert.ok(akaiOnly.length > 0, 'akai partition should have test tracks');
    assert.ok(akaiOnly.every((t) => t.node_id === 'akai'), 'all results must come from akai');
  });

  test('SemAPI - export/import round-trip preserves code and config', async () => {
    const srcId = 'v21-export-src';
    await semApiService.createRoute({
      id: srcId,
      name: 'V21 Export Source',
      path: '/v1/v21/export-source',
      method: 'GET',
      enabled: true,
      auth_required: false,
      rate_limit_rpm: 30,
      code: 'async function handler(ctx) { return ctx.json({ v: 21 }); }',
      tags: ['v21'],
    });

    const bundle: any = await semApiService.exportRoute(srcId);
    assert.ok(bundle, 'export bundle should exist');
    assert.strictEqual(bundle.semarVersion, '2.2.0');
    assert.strictEqual(bundle.route.path, '/v1/v21/export-source');
    assert.ok(!('total_calls' in bundle.route), 'stats must be stripped from export');

    // Import same bundle twice: second import must NOT overwrite (new id)
    const first = await semApiService.importRoutes(bundle);
    assert.strictEqual(first.length, 1);
    const second = await semApiService.importRoutes(bundle);
    assert.strictEqual(second.length, 1);
    assert.notStrictEqual(first[0].id, second[0].id, 'id collision must produce a fresh id');

    const exec = await semApiService.testRoute(second[0].id, {});
    assert.strictEqual(exec.statusCode, 200);
    assert.strictEqual(exec.body.v, 21);

    await semApiService.deleteRoute(srcId);
    await semApiService.deleteRoute(first[0].id);
    await semApiService.deleteRoute(second[0].id);
  });

  test('Cache janitor - purgeExpired removes only stale rows', async () => {
    const db = getDb();
    // Stale row (expired yesterday) + fresh row (expires in 7 days)
    const past = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    const future = new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    const staleId = 'STALE' + Math.random().toString(36).substring(2, 8);
    const freshId = 'FRESH' + Math.random().toString(36).substring(2, 8);

    await cacheService.saveYouTubeCache({
      youtube_video_id: staleId, node_id: 'akai', title: 'stale', artist: 'x', expires_at: past,
    } as any);
    await cacheService.saveYouTubeCache({
      youtube_video_id: freshId, node_id: 'akai', title: 'fresh', artist: 'x', expires_at: future,
    } as any);

    const res = await cacheService.purgeExpired();
    assert.ok(res.purged >= 1, 'at least the stale row should be purged');

    const staleRow = await db.queryOne('SELECT youtube_video_id FROM youtube_cache WHERE youtube_video_id = ?', [staleId]);
    assert.strictEqual(staleRow, null, 'stale row must be gone');
    const freshRow = await db.queryOne('SELECT youtube_video_id FROM youtube_cache WHERE youtube_video_id = ?', [freshId]);
    assert.ok(freshRow, 'fresh row must survive');

    const janitor = await janitorService.runJanitor();
    assert.ok(janitor.ranAt, 'janitor should report a run timestamp');

    await cacheService.purgeYouTubeCache(freshId);
  });

  test('API keys - scoped key carries node restrictions and rpm limit', async () => {
    const gen = await authService.generateApiKey('V21 Scoped Key', ['read'], ['akai'], 5);
    const validated = await authService.validateApiKey(gen.rawKey);
    assert.ok(validated, 'scoped key should validate');
    assert.deepStrictEqual(validated?.node_restrictions, ['akai']);
    assert.strictEqual(validated?.rate_limit_rpm, 5);
    await authService.deleteApiKey(gen.keyItem.id);
  });
});
