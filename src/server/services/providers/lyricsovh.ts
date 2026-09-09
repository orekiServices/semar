import type { LyricsProvider, ProviderTrack } from './types.js';
import { providerFetch } from './types.js';

const BASE = 'https://api.lyrics.ovh/v1';

/** Pure mapper (unit-tested with fixtures, no network needed). */
export function mapLyricsOvhTrack(artist: string, title: string, lyrics: string): ProviderTrack | null {
  const a = (artist || '').trim();
  const t = (title || '').trim();
  const l = (lyrics || '').trim();
  if (!a || !t || !l) return null;
  return {
    providerId: `${a} - ${t}`,
    title: t,
    artist: a,
    plainLyrics: l,
  };
}

/** Parse "Artist - Title" / "Artist: Title" queries for direct lookup. */
export function parseArtistTitle(query: string): { artist: string; title: string } | null {
  const q = (query || '').trim();
  const m = q.match(/^(.+?)\s*[-–:]\s*(.+)$/);
  if (!m) return null;
  const artist = m[1].trim();
  const title = m[2].trim();
  if (!artist || !title) return null;
  return { artist, title };
}

async function lookup(artist: string, title: string): Promise<ProviderTrack | null> {
  const res = await providerFetch(`${BASE}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || typeof data.lyrics !== 'string') return null;
  return mapLyricsOvhTrack(artist, title, data.lyrics);
}

export const lyricsOvhProvider: LyricsProvider = {
  id: 'lyricsovh',
  name: 'Lyrics.ovh · External Library',
  description: 'Plain-lyrics lookup from lyrics.ovh — best with "Artist - Title" queries.',
  homepage: 'https://lyrics.ovh',

  async search(query: string, _limit: number): Promise<ProviderTrack[]> {
    // lyrics.ovh has no search endpoint: only direct "Artist - Title" lookups.
    const parsed = parseArtistTitle(query);
    if (!parsed) return [];
    const track = await lookup(parsed.artist, parsed.title);
    return track ? [track] : [];
  },

  async getById(id: string): Promise<ProviderTrack | null> {
    const parsed = parseArtistTitle(decodeURIComponent(String(id || '')));
    if (!parsed) return null;
    return lookup(parsed.artist, parsed.title);
  },
};
