import type { LyricsProvider, ProviderTrack } from './types.js';
import { lrclibProvider } from './lrclib.js';
import { lyricsOvhProvider } from './lyricsovh.js';
import { cacheService } from '../cache.service.js';
import { getDb } from '../../db/index.js';

export type { LyricsProvider, ProviderTrack };

export interface SpecialNodeDef {
  node_id: string;
  name: string;
  description: string;
  homepage: string;
  provider: LyricsProvider;
  bannerUrl: string;
}

/** Registry of virtual external-library nodes (backed by 3rd-party APIs). */
export const SPECIAL_NODES: SpecialNodeDef[] = [
  {
    node_id: 'lrclib',
    name: 'LRCLIB · External Library',
    description: 'Live gateway to the free LRCLIB synced-lyrics database. No local storage — results stream from lrclib.net with caching.',
    homepage: 'https://lrclib.net',
    provider: lrclibProvider,
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
  },
  {
    node_id: 'lyricsovh',
    name: 'Lyrics.ovh · External Library',
    description: 'Plain-lyrics lookup gateway. Tip: search with the "Artist - Title" format for direct hits.',
    homepage: 'https://lyrics.ovh',
    provider: lyricsOvhProvider,
    bannerUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  },
];

export function getSpecialNode(nodeId: string): SpecialNodeDef | null {
  const id = (nodeId || '').toLowerCase();
  return SPECIAL_NODES.find((n) => n.node_id === id) || null;
}

export function isSpecialNode(nodeId: string): boolean {
  return getSpecialNode(nodeId) !== null;
}

// Cached kill-switch (system_settings.enableExternalNodes, default true)
let externalCache: { enabled: boolean; fetchedAt: number } = { enabled: true, fetchedAt: 0 };

export async function isExternalNodesEnabled(): Promise<boolean> {
  const now = Date.now();
  if (now - externalCache.fetchedAt < 60000) return externalCache.enabled;
  try {
    const db = getDb();
    const row = await db.queryOne<{ value: any }>('SELECT value FROM system_config WHERE key = ?', ['system_settings']);
    let enabled = true;
    if (row) {
      const val = typeof row.value === 'string' ? JSON.parse(row.value || '{}') : row.value;
      if (val && typeof val.enableExternalNodes === 'boolean') enabled = val.enableExternalNodes;
    }
    externalCache = { enabled, fetchedAt: now };
    return enabled;
  } catch {
    return externalCache.enabled;
  }
}

export function _resetExternalCache(): void {
  externalCache = { enabled: true, fetchedAt: 0 };
}

/** Cached provider search (15 min memory TTL, graceful on provider outage). */
export async function cachedProviderSearch(nodeId: string, query: string, limit: number): Promise<ProviderTrack[]> {
  const def = getSpecialNode(nodeId);
  if (!def) return [];
  const key = `provider:${nodeId}:search:${query.toLowerCase().slice(0, 80)}:${limit}`;
  const cached = cacheService.get<ProviderTrack[]>(key);
  if (cached) return cached;
  try {
    const tracks = await def.provider.search(query, limit);
    cacheService.set(key, tracks, 15 * 60 * 1000);
    return tracks;
  } catch {
    return [];
  }
}

/** Cached single-track fetch (6 h memory TTL). */
export async function cachedProviderTrack(nodeId: string, id: string): Promise<ProviderTrack | null> {
  const def = getSpecialNode(nodeId);
  if (!def) return null;
  const key = `provider:${nodeId}:track:${String(id).slice(0, 120)}`;
  const cached = cacheService.get<ProviderTrack>(key);
  if (cached) return cached;
  try {
    const track = await def.provider.getById(String(id));
    if (track) cacheService.set(key, track, 6 * 3600_000);
    return track;
  } catch {
    return null;
  }
}
