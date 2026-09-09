import { getDb } from '../db/index.js';
import { nodeService } from './node.service.js';
import { lyricsService, type LyricsRecord } from './lyrics.service.js';

/**
 * v2.2 — MIN-AI: Markov Intelligence for Lyrics.
 * Trains a word-level Markov chain on every plain lyric in the local
 * catalog, then generates original lines, finds tracks by vibe (AI Finder),
 * and surfaces similar songs. Zero external dependencies, fully local.
 */

export interface MinaiModelStats {
  tracks: number;
  chars: number;
  states: number;
  order: number;
  trainedAt: string;
}

export interface MinaiModel {
  version: 1;
  order: number;
  chain: Record<string, string[]>;
  starts: string[];
  stats: MinaiModelStats;
}

interface CorpusTrack {
  node_id: string;
  id: number | string;
  title: string;
  artist: string;
  plain: string;
}

const STOPWORDS = new Set(
  'the,a,an,and,or,but,to,of,in,on,at,for,with,you,your,i,me,my,we,our,it,its,is,are,was,were,be,been,as,so,oh,yeah,uh,la,na,hey,hi,do,does,just,now,here,there,that,this,these,those,not,no,yes,if,then,than,too,very,can,could,would,should,will,all,any,from,into,over,under,up,down,out,off,by'.split(',')
);

export function tokenizeMinai(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 0 && w !== "'");
}

/** Deterministic RNG (mulberry32) so generations can be reproduced / tested. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODEL_KEY = 'minai_model';

class MinaiService {
  private modelCache: MinaiModel | null = null;
  private modelCacheAt: number = 0;
  private artistCache = new Map<string, { model: MinaiModel; at: number }>();

  /** Collect plain-lyrics corpus across local nodes (specials excluded). */
  async collectCorpus(maxTracks: number = 5000): Promise<CorpusTrack[]> {
    const nodes = await nodeService.listNodes();
    const local = nodes.filter((n) => n.status === 'active' && !n.is_special);
    const out: CorpusTrack[] = [];
    const db = getDb();

    for (const node of local) {
      if (out.length >= maxTracks) break;
      const tableName = `lyrics_${node.node_id}`;
      let offset = 0;
      const pageSize = 500;
      for (;;) {
        if (out.length >= maxTracks) break;
        let rows: any[];
        try {
          rows = await db.query<any>(
            `SELECT id, title, artist, plain_lyrics FROM "${tableName}"
             WHERE plain_lyrics IS NOT NULL AND plain_lyrics <> ''
             ORDER BY id ASC LIMIT ? OFFSET ?`,
            [Math.min(pageSize, maxTracks - out.length), offset]
          );
        } catch {
          break; // missing table etc. — skip node
        }
        if (rows.length === 0) break;
        for (const r of rows) {
          const plain = (r.plain_lyrics || '').trim();
          if (plain) out.push({ node_id: node.node_id, id: r.id, title: r.title, artist: r.artist, plain });
          if (out.length >= maxTracks) break;
        }
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
    }
    return out;
  }

  buildChain(texts: string[], order: number = 2): { chain: Record<string, string[]>; starts: string[]; chars: number } {
    const chain: Record<string, string[]> = {};
    const starts: string[] = [];
    let chars = 0;
    const o = Math.min(Math.max(order, 1), 3);

    for (const text of texts) {
      chars += text.length;
      // Train per line so generations keep lyric-like phrasing
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const words = tokenizeMinai(line);
        if (words.length <= o) continue;
        starts.push(words.slice(0, o).join(' '));
        for (let i = 0; i + o < words.length; i++) {
          const key = words.slice(i, i + o).join(' ');
          const next = words[i + o];
          (chain[key] ||= []).push(next);
        }
      }
    }
    return { chain, starts, chars };
  }

  async trainModel(options: { maxTracks?: number; order?: number } = {}): Promise<MinaiModelStats & { modelBytes: number }> {
    const maxTracks = Math.min(Math.max(options.maxTracks || 3000, 10), 20000);
    const order = Math.min(Math.max(options.order || 2, 1), 3);

    const corpus = await this.collectCorpus(maxTracks);
    if (corpus.length === 0) {
      throw Object.assign(new Error('Cannot train MIN-AI: no plain lyrics in local nodes yet. Add lyrics to a node first.'), { statusCode: 400 });
    }

    const { chain, starts, chars } = this.buildChain(corpus.map((c) => c.plain), order);
    const stats: MinaiModelStats = {
      tracks: corpus.length,
      chars,
      states: Object.keys(chain).length,
      order,
      trainedAt: new Date().toISOString(),
    };
    const model: MinaiModel = { version: 1, order, chain, starts, stats };

    const db = getDb();
    const payload = JSON.stringify(model);
    const existing = await db.queryOne('SELECT key FROM system_config WHERE key = ?', [MODEL_KEY]);
    if (existing) {
      await db.execute('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [payload, MODEL_KEY]);
    } else {
      await db.execute('INSERT INTO system_config (key, value) VALUES (?, ?)', [MODEL_KEY, payload]);
    }

    this.modelCache = model;
    this.modelCacheAt = Date.now();
    this.artistCache.clear();
    return { ...stats, modelBytes: payload.length };
  }

  async loadModel(): Promise<MinaiModel | null> {
    if (this.modelCache && Date.now() - this.modelCacheAt < 10 * 60_000) return this.modelCache;
    try {
      const db = getDb();
      const row = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', [MODEL_KEY]);
      if (!row) return null;
      const model = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) as MinaiModel;
      if (!model || model.version !== 1 || !model.chain) return null;
      this.modelCache = model;
      this.modelCacheAt = Date.now();
      return model;
    } catch {
      return this.modelCache;
    }
  }

  async getStatus(): Promise<{ trained: boolean; stats: MinaiModelStats | null }> {
    const model = await this.loadModel();
    return { trained: Boolean(model), stats: model?.stats || null };
  }

  private async artistModel(artist: string): Promise<MinaiModel | null> {
    const key = artist.toLowerCase().trim();
    const hit = this.artistCache.get(key);
    if (hit && Date.now() - hit.at < 3600_000) return hit.model;

    const corpus = await this.collectCorpus(3000);
    const mine = corpus.filter((c) => c.artist.toLowerCase().includes(key) || key.includes(c.artist.toLowerCase()));
    if (mine.length === 0) return null;
    const { chain, starts, chars } = this.buildChain(mine.map((c) => c.plain), 2);
    const model: MinaiModel = {
      version: 1,
      order: 2,
      chain,
      starts,
      stats: { tracks: mine.length, chars, states: Object.keys(chain).length, order: 2, trainedAt: new Date().toISOString() },
    };
    this.artistCache.set(key, { model, at: Date.now() });
    if (this.artistCache.size > 20) {
      const oldest = this.artistCache.keys().next().value;
      if (oldest) this.artistCache.delete(oldest);
    }
    return model;
  }

  private pickStart(model: MinaiModel, seed: string, rng: () => number): string {
    const keys = Object.keys(model.chain);
    if (keys.length === 0) return '';
    const s = (seed || '').toLowerCase().trim();
    if (s) {
      const seedTokens = tokenizeMinai(s);
      const matches = keys.filter((k) => seedTokens.some((t) => k.split(' ').includes(t)));
      if (matches.length > 0) return matches[Math.floor(rng() * matches.length)];
      // fall back: state starting with the seed text
      const prefixed = keys.filter((k) => k.startsWith(seedTokens.join(' ')));
      if (prefixed.length > 0) return prefixed[Math.floor(rng() * prefixed.length)];
    }
    const pool = model.starts.length > 0 ? model.starts : keys;
    return pool[Math.floor(rng() * pool.length)];
  }

  async generate(options: { seed?: string; lines?: number; wordsPerLine?: number; artist?: string; rngSeed?: number } = {}): Promise<{
    lines: string[];
    seed: string;
    artist?: string;
    wordsGenerated: number;
    model: { tracks: number; states: number; trainedAt: string };
  }> {
    const lineCount = Math.min(Math.max(options.lines || 8, 1), 32);
    const artist = (options.artist || '').trim();

    let model: MinaiModel | null;
    if (artist) {
      model = await this.artistModel(artist);
      if (!model) {
        throw Object.assign(new Error(`MIN-AI has no lyrics by "${artist}" to learn from yet.`), { statusCode: 404 });
      }
    } else {
      model = await this.loadModel();
      if (!model) {
        // Lazy first train so the AI page works out of the box
        try {
          await this.trainModel();
          model = await this.loadModel();
        } catch (err: any) {
          throw err;
        }
      }
      if (!model) throw Object.assign(new Error('MIN-AI model is not trained yet.'), { statusCode: 400 });
    }

    const rng = options.rngSeed !== undefined ? mulberry32(options.rngSeed) : Math.random;
    const lines: string[] = [];
    let state = this.pickStart(model, options.seed || '', rng);
    let wordsGenerated = 0;

    for (let li = 0; li < lineCount; li++) {
      const targetWords = options.wordsPerLine || 5 + Math.floor(rng() * 5);
      const words = state ? state.split(' ') : [];
      while (words.length < targetWords) {
        const key = words.slice(-model.order).join(' ');
        const nexts = model.chain[key];
        if (!nexts || nexts.length === 0) break;
        words.push(nexts[Math.floor(rng() * nexts.length)]);
      }
      if (words.length > 0) {
        words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        lines.push(words.join(' '));
        wordsGenerated += words.length;
      }
      // fresh random start for the next line (keeps verses varied)
      state = this.pickStart(model, '', rng);
    }

    return {
      lines,
      seed: options.seed || '',
      artist: artist || undefined,
      wordsGenerated,
      model: { tracks: model.stats.tracks, states: model.stats.states, trainedAt: model.stats.trainedAt },
    };
  }

  /** Score tracks against query tokens (distinct matches weigh most). */
  private scoreTrack(queryTokens: string[], queryRaw: string, plain: string): number {
    const text = plain.toLowerCase();
    const trackTokens = new Set(tokenizeMinai(plain).filter((t) => !STOPWORDS.has(t) && t.length > 2));
    let distinct = 0;
    let total = 0;
    for (const qt of queryTokens) {
      if (trackTokens.has(qt)) {
        distinct++;
        total += 1;
      }
    }
    if (distinct === 0) return 0;
    const lengthPenalty = Math.log10(plain.length + 10);
    let score = (distinct * 3 + total) / lengthPenalty;
    if (queryRaw.trim().length > 3 && text.includes(queryRaw.toLowerCase().trim())) score += 10;
    return Math.round(score * 100) / 100;
  }

  private snippetFor(plain: string, queryTokens: string[]): string {
    const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const low = line.toLowerCase();
      if (queryTokens.some((t) => low.includes(t))) return line.slice(0, 160);
    }
    return (lines[0] || '').slice(0, 160);
  }

  /**
   * AI Finder — find tracks by vibe/keywords across local nodes, ranked by
   * token-overlap relevance with exact-phrase bonus.
   */
  async finder(query: string, limit: number = 10): Promise<Array<{ track: CorpusTrack; score: number; snippet: string }>> {
    const q = (query || '').trim();
    if (!q) return [];
    const queryTokens = [...new Set(tokenizeMinai(q).filter((t) => !STOPWORDS.has(t) && t.length > 1))];
    if (queryTokens.length === 0) return [];

    const corpus = await this.collectCorpus(5000);
    const scored = corpus
      .map((track) => ({ track, score: this.scoreTrack(queryTokens, q, track.plain) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(limit, 1), 50));

    return scored.map((s) => ({ ...s, snippet: this.snippetFor(s.track.plain, queryTokens) }));
  }

  /** "More like this" — tracks with the most lyric-vocabulary overlap. */
  async similar(nodeId: string, id: number | string, limit: number = 8): Promise<Array<{ track: LyricsRecord; score: number }>> {
    const source = await lyricsService.getLyricsById(nodeId, id);
    if (!source || !source.plain_lyrics) {
      throw Object.assign(new Error('Source track not found or has no plain lyrics'), { statusCode: 404 });
    }
    const queryTokens = [...new Set(tokenizeMinai(source.plain_lyrics).filter((t) => !STOPWORDS.has(t) && t.length > 2))].slice(0, 60);
    if (queryTokens.length === 0) return [];

    const corpus = await this.collectCorpus(5000);
    const scored: Array<{ track: LyricsRecord; score: number }> = [];
    for (const c of corpus) {
      if (String(c.id) === String(source.id) && c.node_id === source.node_id) continue;
      const score = this.scoreTrack(queryTokens, '', c.plain);
      if (score > 0) {
        scored.push({
          track: { id: c.id, node_id: c.node_id, title: c.title, artist: c.artist, plain_lyrics: c.plain },
          score,
        });
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 30));
  }

  /** Test helper: drop memory caches. */
  _resetCaches(): void {
    this.modelCache = null;
    this.modelCacheAt = 0;
    this.artistCache.clear();
  }
}

export const minaiService = new MinaiService();
