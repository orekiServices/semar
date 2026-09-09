<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
    <div class="space-y-3">
      <span class="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 uppercase tracking-wide">
        Developer Reference
      </span>
      <h2 class="text-3xl sm:text-4xl font-black text-white tracking-tight">API & SemAPI Documentation</h2>
      <p class="text-sm text-slate-300 max-w-3xl leading-relaxed">
        Integrate Semar with external audio players, Spotify bots, Discord music bots, or mobile karaoke apps.
        Semar offers both core REST endpoints and dynamic administrator-defined <strong>SemAPI</strong> serverless functions.
      </p>
    </div>

    <!-- Filter & Search Tabs -->
    <div class="flex items-center gap-2 border-b border-slate-800 pb-3">
      <button
        @click="activeTab = 'core'"
        class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
        :class="activeTab === 'core' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
      >
        <Server class="w-4 h-4" />
        Core REST APIs
      </button>
      <button
        @click="activeTab = 'semapi'"
        class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
        :class="activeTab === 'semapi' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
      >
        <Zap class="w-4 h-4 text-pink-400" />
        Dynamic SemAPI Routes ({{ semapiRoutes.length }})
      </button>
    </div>

    <!-- Core APIs List -->
    <div v-if="activeTab === 'core'" class="space-y-4">
      <div
        v-for="(ep, idx) in coreEndpoints"
        :key="idx"
        class="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-black"
              :class="getMethodClass(ep.method)"
            >
              {{ ep.method }}
            </span>
            <code class="text-sm font-bold text-white font-mono">{{ ep.path }}</code>
          </div>
          <span class="text-xs text-slate-400">{{ ep.summary }}</span>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">{{ ep.description }}</p>

        <!-- Curl Example -->
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-xs flex items-center justify-between text-slate-300">
          <code class="truncate mr-4 text-violet-300">{{ ep.curl }}</code>
          <button
            @click="copyText(ep.curl)"
            class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold transition shrink-0"
          >
            Copy curl
          </button>
        </div>
      </div>
    </div>

    <!-- SemAPI Dynamic Routes -->
    <div v-else class="space-y-4">
      <div v-if="semapiRoutes.length === 0" class="py-12 text-center text-slate-500">
        No public SemAPI routes registered.
      </div>
      <div
        v-for="route in semapiRoutes"
        :key="route.id"
        class="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-black"
              :class="getMethodClass(route.method)"
            >
              {{ route.method }}
            </span>
            <code class="text-sm font-bold text-white font-mono">/api/semapi/run{{ route.path }}</code>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="route.auth_required" class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              API Key Required
            </span>
            <span class="text-[10px] font-mono text-slate-400">{{ route.rate_limit_rpm }} rpm</span>
          </div>
        </div>

        <div>
          <h4 class="font-bold text-white text-sm">{{ route.name }}</h4>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">{{ route.description || 'Custom administrator dynamic endpoint executed in Node.js VM.' }}</p>
        </div>

        <!-- Try it out button -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <div class="text-[11px] font-mono text-slate-400">
            Calls: {{ route.total_calls }}
          </div>
          <a
            :href="`/api/semapi/run${route.path}`"
            target="_blank"
            class="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            Execute in Browser
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../stores/system.store.js';
import { Server, Zap, Play } from 'lucide-vue-next';

const systemStore = useSystemStore();
const activeTab = ref<'core' | 'semapi'>('core');
const semapiRoutes = ref<any[]>([]);

const coreEndpoints = [
  {
    method: 'GET',
    path: '/api/v1/lyrics/search?q={query}&limit={limit}',
    summary: 'Global Multi-Node Lyrics Search',
    description: 'Searches all active database partitions for matching tracks by title, artist, album, or plain lyric text.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/search?q=Gurenge"',
  },
  {
    method: 'GET',
    path: '/api/v1/lyrics/:nodeId/:id/ttml',
    summary: 'Apple Music TTML Syllable Lyrics Export',
    description: 'Retrieves Apple Music compliant Timed Text Markup Language (TTML XML) with syllable/word timestamps and iTunes metadata schema.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/anime/1/ttml"',
  },
  {
    method: 'GET',
    path: '/api/v1/lyrics/youtube/:videoId',
    summary: 'YouTube Video ID Lyrics Resolver',
    description: 'Instant zero-latency cache lookup for YouTube Video IDs resolving to synchronized LRC and TTML lyrics.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/youtube/CwkzK-Fh400"',
  },
  {
    method: 'GET',
    path: '/api/v1/nodes',
    summary: 'List All Semar Storage Nodes',
    description: 'Returns all nodes — local partitions plus read-only external libraries (lrclib, lyricsovh).',
    curl: 'curl -X GET "http://localhost:3000/api/v1/nodes"',
  },
  {
    method: 'GET',
    path: '/api/v1/nodes/:nodeId/lyrics',
    summary: 'Browse Lyrics in Specific Node Partition',
    description: 'Queries the isolated lyrics table belonging strictly to the requested nodeId.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/nodes/anime/lyrics?limit=20"',
  },
  {
    method: 'GET',
    path: '/api/v1/cache/stats',
    summary: 'Cache Hit & Memory Metrics',
    description: 'Returns real-time memory LRU cache and persistent YouTube cache statistics.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/cache/stats"',
  },
  {
    method: 'GET',
    path: '/api/v1/lyrics/random',
    summary: 'Random Track (v2.2)',
    description: 'Returns one random track from the local catalog — powers Surprise Me playback.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/random"',
  },
  {
    method: 'POST',
    path: '/api/minai/generate',
    summary: 'MIN-AI Lyric Generator (v2.2)',
    description: 'Generates original lyric lines from a Markov model trained on all local plain lyrics. Optional seed word, line count, and artist style.',
    curl: 'curl -X POST "http://localhost:3000/api/minai/generate" -H "Content-Type: application/json" -d \'{"seed": "midnight", "lines": 4}\'',
  },
  {
    method: 'GET',
    path: '/api/minai/finder?q={vibe}',
    summary: 'AI Finder (v2.2)',
    description: 'Ranks catalog tracks by lyric-vocabulary overlap with a vibe, mood, or keyword query. Returns match scores and snippets.',
    curl: 'curl -X GET "http://localhost:3000/api/minai/finder?q=midnight%20city%20lights"',
  },
  {
    method: 'GET',
    path: '/api/minai/similar/:nodeId/:id',
    summary: 'Similar Tracks (v2.2)',
    description: 'Finds tracks with the most similar lyric vocabulary to a given song. Powers the More Like This rail.',
    curl: 'curl -X GET "http://localhost:3000/api/minai/similar/anime/1"',
  },
];

onMounted(async () => {
  try {
    const res = await fetch('/api/semapi/routes/public');
    const data = await res.json();
    if (data.routes) {
      semapiRoutes.value = data.routes;
    }
  } catch {}
});

function getMethodClass(method: string) {
  switch (method.toUpperCase()) {
    case 'GET': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'POST': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'PUT': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    case 'DELETE': return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    default: return 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
  }
}

function copyText(txt: string) {
  navigator.clipboard.writeText(txt);
  systemStore.addToast('Copied to clipboard!', '', 'success');
}
</script>
