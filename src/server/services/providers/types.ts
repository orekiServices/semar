/**
 * v2.2 — Third-party lyrics provider interface.
 * Special nodes (lrclib, lyricsovh, ...) are virtual nodes backed by these
 * providers instead of local database tables.
 */

export interface ProviderTrack {
  /** Stable provider-side id (number for LRCLIB, "Artist - Title" for lyrics.ovh). */
  providerId: number | string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental?: boolean;
  providerUrl?: string;
}

export interface LyricsProvider {
  /** Must match the special node_id (e.g. 'lrclib'). */
  id: string;
  name: string;
  description: string;
  homepage: string;
  /** Full-text search. Returns [] when the provider can't serve the query. */
  search(query: string, limit: number): Promise<ProviderTrack[]>;
  /** Fetch one track by provider id. */
  getById(id: string): Promise<ProviderTrack | null>;
}

/** Shared fetch with timeout + UA (LRCLIB requires a User-Agent). */
export async function providerFetch(url: string, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Semar/2.2 (https://github.com/orekiServices/semar)',
        Accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
