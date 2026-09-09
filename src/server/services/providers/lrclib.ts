import type { LyricsProvider, ProviderTrack } from './types.js';
import { providerFetch } from './types.js';

const BASE = 'https://lrclib.net/api';

/** Pure mapper (unit-tested with fixtures, no network needed). */
export function mapLrclibTrack(raw: any): ProviderTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = (raw.trackName || raw.name || '').toString().trim();
  const artist = (raw.artistName || '').toString().trim();
  if (!title || !artist || raw.id === undefined || raw.id === null) return null;
  return {
    providerId: Number(raw.id),
    title,
    artist,
    album: (raw.albumName || '').toString() || undefined,
    duration: raw.duration ? Math.round(Number(raw.duration)) : undefined,
    plainLyrics: (raw.plainLyrics || '').toString() || undefined,
    syncedLyrics: (raw.syncedLyrics || '').toString() || undefined,
    instrumental: Boolean(raw.instrumental),
    providerUrl: `https://lrclib.net/api/get/${raw.id}`,
  };
}

export const lrclibProvider: LyricsProvider = {
  id: 'lrclib',
  name: 'LRCLIB · External Library',
  description: 'Millions of community-synced tracks from the free LRCLIB database (plain + synced LRC).',
  homepage: 'https://lrclib.net',

  async search(query: string, limit: number): Promise<ProviderTrack[]> {
    const q = (query || '').trim();
    if (!q) return [];
    const res = await providerFetch(`${BASE}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) return [];
    const out: ProviderTrack[] = [];
    for (const raw of data.slice(0, Math.max(limit, 1))) {
      const mapped = mapLrclibTrack(raw);
      if (mapped) out.push(mapped);
    }
    return out;
  },

  async getById(id: string): Promise<ProviderTrack | null> {
    const numId = String(id || '').trim();
    if (!/^\d+$/.test(numId)) return null;
    const res = await providerFetch(`${BASE}/get/${numId}`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return mapLrclibTrack(data);
  },
};
