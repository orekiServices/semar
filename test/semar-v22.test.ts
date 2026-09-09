import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { initDatabase, getDb } from '../src/server/db/index.js';
import { nodeService } from '../src/server/services/node.service.js';
import { lyricsService } from '../src/server/services/lyrics.service.js';
import { authService } from '../src/server/services/auth.service.js';
import { minaiService, tokenizeMinai } from '../src/server/services/minai.service.js';
import {
  SPECIAL_NODES,
  getSpecialNode,
  isSpecialNode,
  cachedProviderSearch,
  cachedProviderTrack,
} from '../src/server/services/providers/index.js';
import { mapLrclibTrack } from '../src/server/services/providers/lrclib.js';
import { mapLyricsOvhTrack, parseArtistTitle } from '../src/server/services/providers/lyricsovh.js';

describe('Semar v2.2 Suite - Postgres-only, special nodes, MIN-AI', () => {
  before(async () => {
    await initDatabase(true);
    minaiService._resetCaches();
  });

  test('Fresh installs start with zero local nodes (no defaults)', async () => {
    const nodes = await nodeService.listNodes();
    const local = nodes.filter((n) => !n.is_special);
    assert.strictEqual(local.length, 0, 'fresh DB must have no local nodes');
  });

  test('Special external nodes are always listed (virtual, no tables)', async () => {
    const nodes = await nodeService.listNodes();
    const ids = nodes.filter((n) => n.is_special).map((n) => n.node_id).sort();
    assert.deepStrictEqual(ids, ['lrclib', 'lyricsovh']);
    assert.strictEqual(SPECIAL_NODES.length, 2);

    const lrclib = await nodeService.getNode('lrclib');
    assert.ok(lrclib, 'lrclib special node should resolve');
    assert.strictEqual(lrclib.storage_mode, 'external');
    assert.strictEqual(lrclib.table_name, '');
    assert.ok(isSpecialNode('LRCLIB'), 'special lookup must be case-insensitive');
    assert.ok(!isSpecialNode('akai'), 'akai is not special');
    assert.strictEqual(getSpecialNode('nope'), null);
  });

  test('Special node ids are reserved and read-only', async () => {
    await assert.rejects(() => nodeService.createNode({ node_id: 'lrclib', name: 'x' } as any), /reserved/);
    await assert.rejects(() => nodeService.updateNode('lrclib', { name: 'x' } as any), /cannot be modified/);
    await assert.rejects(() => nodeService.deleteNode('lyricsovh'), /cannot be deleted/);
    await assert.rejects(() => lyricsService.saveLyrics('lrclib', { title: 't', artist: 'a' } as any), /Cannot write/);
  });

  test('Random track returns null on empty catalog', async () => {
    const track = await lyricsService.getRandom();
    assert.strictEqual(track, null);
  });

  test('MIN-AI refuses to train on an empty catalog', async () => {
    const status = await minaiService.getStatus();
    assert.strictEqual(status.trained, false);
    await assert.rejects(() => minaiService.trainModel(), /no plain lyrics/);
    await assert.rejects(() => minaiService.generate({ lines: 4 }), /no plain lyrics/);
  });

  test('Provider mappers normalize fixtures without network', async () => {
    const lrclibRaw = {
      id: 123456,
      trackName: 'Test Song',
      artistName: 'Test Artist',
      albumName: 'Test Album',
      duration: 200.5,
      instrumental: false,
      plainLyrics: 'hello world\nsecond line',
      syncedLyrics: '[00:01.00] hello world',
    };
    const mapped = mapLrclibTrack(lrclibRaw);
    assert.ok(mapped);
    assert.strictEqual(mapped.providerId, 123456);
    assert.strictEqual(mapped.title, 'Test Song');
    assert.strictEqual(mapped.duration, 201);
    assert.strictEqual(mapLrclibTrack({}), null);
    assert.strictEqual(mapLrclibTrack(null), null);

    const ovh = mapLyricsOvhTrack('Coldplay', 'Yellow', 'Look at the stars');
    assert.ok(ovh);
    assert.strictEqual(ovh.providerId, 'Coldplay - Yellow');
    assert.strictEqual(mapLyricsOvhTrack('a', 'b', ''), null);

    assert.deepStrictEqual(parseArtistTitle('Coldplay - Yellow'), { artist: 'Coldplay', title: 'Yellow' });
    assert.deepStrictEqual(parseArtistTitle('LiSA: Gurenge'), { artist: 'LiSA', title: 'Gurenge' });
    assert.strictEqual(parseArtistTitle('just some words'), null);

    // Unknown providers never touch the network
    assert.deepStrictEqual(await cachedProviderSearch('nope', 'x', 5), []);
    assert.strictEqual(await cachedProviderTrack('nope', '1'), null);
  });

  test('Missing node tables read as empty instead of 500', async () => {
    const db = getDb();
    // Register a node row WITHOUT creating its partition table
    await db.execute(
      `INSERT INTO nodes (node_id, name, description, table_name, storage_mode, is_nsfw, status, rate_limit, total_records_approx, about_config, api_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ghostnode', 'Ghost', '', 'lyrics_ghostnode', 'isolated_table', false, 'active', 120, 0, '{}', '{}']
    );
    assert.deepStrictEqual(await lyricsService.searchNode('ghostnode', 'anything'), []);
    assert.strictEqual(await lyricsService.countNodeLyrics('ghostnode', ''), 0);
    assert.strictEqual(await lyricsService.getLyricsById('ghostnode', 1), null);
    await db.execute('DELETE FROM nodes WHERE node_id = ?', ['ghostnode']);
  });

  test('MIN-AI trains on local lyrics and generates deterministically', async () => {
    await nodeService.createNode({ node_id: 'minai', name: 'MIN-AI Test Node' } as any);
    await lyricsService.saveLyrics('minai', {
      title: 'Neon Skyline',
      artist: 'Vector Seven',
      plain_lyrics: 'neon lights over the midnight city\nmidnight city never sleeps alone\nalone we chase the electric morning',
    });
    await lyricsService.saveLyrics('minai', {
      title: 'Paper Satellite',
      artist: 'Vector Seven',
      plain_lyrics: 'paper satellite in paper skies\nskies of silver static bloom\nbloom like midnight thunder over paper towns',
    });
    await lyricsService.saveLyrics('minai', {
      title: 'Rusty Compass',
      artist: 'Analog Ghost',
      plain_lyrics: 'rusty compass points to nowhere roads\nnowhere roads hum a copper tune\ntune the dial to forgotten stations',
    });

    const stats = await minaiService.trainModel({ maxTracks: 100 });
    assert.strictEqual(stats.tracks, 3);
    assert.ok(stats.states > 5, 'chain should have states');
    assert.ok(stats.modelBytes > 100);

    const status = await minaiService.getStatus();
    assert.strictEqual(status.trained, true);

    // Deterministic with rngSeed
    const a = await minaiService.generate({ lines: 4, rngSeed: 42 });
    const b = await minaiService.generate({ lines: 4, rngSeed: 42 });
    assert.deepStrictEqual(a.lines, b.lines);
    assert.strictEqual(a.lines.length, 4);

    // Every generated word must come from the corpus vocabulary
    const vocab = new Set(tokenizeMinai('neon lights over the midnight city midnight city never sleeps alone alone we chase the electric morning paper satellite in paper skies skies of silver static bloom bloom like thunder over paper towns rusty compass points to nowhere roads nowhere roads hum a copper tune tune the dial to forgotten stations'));
    for (const line of a.lines) {
      for (const w of tokenizeMinai(line)) {
        assert.ok(vocab.has(w), `generated word "${w}" must come from corpus vocab`);
      }
    }

    // Seeded start prefers states containing the seed word
    const seeded = await minaiService.generate({ lines: 6, seed: 'midnight', rngSeed: 7 });
    assert.ok(seeded.lines.join(' ').toLowerCase().includes('midnight'), 'seed word should appear');

    // Artist-styled model uses only that artist's vocabulary
    const styled = await minaiService.generate({ lines: 3, artist: 'Vector Seven', rngSeed: 3 });
    assert.strictEqual(styled.artist, 'Vector Seven');
    const vectorVocab = new Set(tokenizeMinai('neon lights over the midnight city midnight city never sleeps alone alone we chase the electric morning paper satellite in paper skies skies of silver static bloom bloom like thunder over paper towns'));
    for (const line of styled.lines) {
      for (const w of tokenizeMinai(line)) {
        assert.ok(vectorVocab.has(w), `styled word "${w}" must come from artist vocab`);
      }
    }

    await assert.rejects(() => minaiService.generate({ artist: 'Nobody Exists' }), /no lyrics by/);
  });

  test('AI Finder ranks the rare-word track first with a snippet', async () => {
    const results = await minaiService.finder('satellite static', 5);
    assert.ok(results.length > 0, 'finder should return matches');
    assert.strictEqual(results[0].track.title, 'Paper Satellite');
    assert.ok(results[0].score > 0);
    assert.ok(results[0].snippet.toLowerCase().includes('satellite') || results[0].snippet.toLowerCase().includes('static'));

    const empty = await minaiService.finder('the and of', 5);
    assert.deepStrictEqual(empty, [], 'stopword-only queries return nothing');
    assert.deepStrictEqual(await minaiService.finder('', 5), []);
  });

  test('Similar tracks exclude the source and share vocabulary', async () => {
    const found = await lyricsService.searchNode('minai', 'Neon Skyline');
    assert.strictEqual(found.length, 1);
    const similar = await minaiService.similar('minai', Number(found[0].id), 5);
    assert.ok(similar.length >= 1, 'should find similar tracks');
    assert.ok(similar.every((s) => String(s.track.id) !== String(found[0].id)), 'source must be excluded');
    assert.ok(similar[0].score > 0);
  });

  test('Random track serves from populated local nodes', async () => {
    const track = await lyricsService.getRandom();
    assert.ok(track, 'random should return a track once data exists');
    assert.strictEqual(track.node_id, 'minai');
    assert.ok(track.title);
  });

  test('Auth - seeded admin can log in and rotate password (username-keyed)', async () => {
    const login = await authService.authenticateAdmin('admin', 'admin123456');
    assert.ok(login, 'seeded admin must authenticate');
    assert.ok(login!.token, 'login must issue a JWT');
    assert.strictEqual(login!.user.username, 'admin');
    assert.strictEqual(await authService.authenticateAdmin('admin', 'wrong-pass'), null);

    const rotated = await authService.changeAdminPassword('admin', 'admin654321');
    assert.strictEqual(rotated, true);
    const relogin = await authService.authenticateAdmin('admin', 'admin654321');
    assert.ok(relogin, 'rotated password must authenticate');
    await authService.changeAdminPassword('admin', 'admin123456'); // restore seed password
  });

  test('Admin seed still provisions login + starter SemAPI routes', async () => {
    const db = getDb();
    const admin = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM admin_users');
    assert.ok(Number(admin?.count) >= 1, 'default admin must exist');
    const routes = await db.query<{ id: string }>('SELECT id FROM semapi_routes');
    const ids = routes.map((r) => r.id);
    assert.ok(ids.includes('route-fast-anime'), 'seeded semapi routes must exist');
    assert.ok(ids.includes('route-minai-generate'), 'MIN-AI semapi route must exist');
  });
});
