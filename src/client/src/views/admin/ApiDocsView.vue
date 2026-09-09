<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">API Documentation & Swagger Console</h2>
      <p class="text-xs text-slate-400 mt-1">Interactive OpenAPI explorer and test runner for all native endpoints and SemAPI dynamic routes.</p>
    </div>

    <!-- Overview Box -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-3">
      <h3 class="text-base font-bold text-white">Semar REST & SemAPI Specification</h3>
      <p class="text-xs text-slate-300 leading-relaxed">
        Base URL: <code class="text-violet-300 font-mono">http://localhost:3000/api</code> • Format: JSON • Auth: Bearer Token or <code>X-SemAPI-Key</code>
      </p>
    </div>

    <!-- Dynamic Endpoint Cards -->
    <div class="space-y-4">
      <div
        v-for="(ep, idx) in endpoints"
        :key="idx"
        class="glass-panel rounded-2xl border border-slate-800 p-5 space-y-3"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-black"
              :class="getMethodClass(ep.method)"
            >
              {{ ep.method }}
            </span>
            <code class="text-sm font-bold text-white font-mono">{{ ep.path }}</code>
          </div>
          <span class="text-xs text-slate-400 font-mono">{{ ep.scope }}</span>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">{{ ep.description }}</p>

        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-violet-300 flex items-center justify-between">
          <code class="truncate mr-4">{{ ep.curl }}</code>
          <button
            @click="copyCurl(ep.curl)"
            class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold transition shrink-0"
          >
            Copy cURL
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';

const systemStore = useSystemStore();

const endpoints = ref<any[]>([
  {
    method: 'GET',
    path: '/api/v1/lyrics/search?q={query}&limit={limit}',
    scope: 'Public / Core',
    description: 'Searches all active nodes (local partitions first, then external libraries) with full-text matching and view count ranking.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/search?q=Gurenge"',
  },
  {
    method: 'GET',
    path: '/api/v1/lyrics/:nodeId/:id/ttml',
    scope: 'Public / Core',
    description: 'Returns raw Apple Music compliant TTML XML lyrics payload with syllable span markers.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/anime/1/ttml"',
  },
  {
    method: 'GET',
    path: '/api/v1/lyrics/youtube/:videoId',
    scope: 'Cache / Core',
    description: 'Resolves YouTube Video ID to cached synchronized LRC lyrics and Apple Music TTML with zero-latency promotion.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/lyrics/youtube/CwkzK-Fh400"',
  },
  {
    method: 'POST',
    path: '/api/v1/lyrics/youtube/associate',
    scope: 'Admin Protected',
    description: 'Manually maps or updates a YouTube Video ID association to a song record.',
    curl: 'curl -X POST "http://localhost:3000/api/v1/lyrics/youtube/associate" -H "Authorization: Bearer <token>" -d \'{"videoId": "CwkzK-Fh400", "nodeId": "anime"}\'',
  },
  {
    method: 'GET',
    path: '/api/v1/nodes',
    scope: 'Public / Core',
    description: 'Lists all registered database partitions and their approximate record counts.',
    curl: 'curl -X GET "http://localhost:3000/api/v1/nodes"',
  },
  {
    method: 'ALL',
    path: '/api/semapi/run/:path*',
    scope: 'SemAPI Runtime',
    description: 'Dynamic JavaScript execution dispatcher running in isolated Node.js VM context. Handlers can call ctx.minai.generate/finder/similar.',
    curl: 'curl -X GET "http://localhost:3000/api/semapi/run/v1/anime/search?q=LiSA"',
  },
  {
    method: 'POST',
    path: '/api/minai/train',
    scope: 'Admin Protected',
    description: 'Rebuilds the MIN-AI Markov model from all local plain lyrics. Runs automatically on first generate call.',
    curl: 'curl -X POST "http://localhost:3000/api/minai/train" -H "Authorization: Bearer <token>" -d \'{}\'',
  },
]);

function getMethodClass(method: string) {
  switch (method.toUpperCase()) {
    case 'GET': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'POST': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'PUT': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    case 'DELETE': return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    default: return 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
  }
}

function copyCurl(c: string) {
  navigator.clipboard.writeText(c);
  systemStore.addToast('Copied cURL command', '', 'success');
}
</script>
