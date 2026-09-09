<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12">
    <!-- Hero Section -->
    <div class="relative rounded-3xl overflow-hidden glass-panel border border-slate-800 p-8 sm:p-14 text-center shadow-2xl">
      <div class="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-pink-600/10 to-indigo-600/10 opacity-70"></div>
      <div class="relative z-10 max-w-3xl mx-auto space-y-4">
        <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold tracking-wide">
          <Sparkles class="w-3.5 h-3.5 text-pink-400" />
          <span>Multi-Node PostgreSQL Lyrics Engine</span>
        </span>
        <h2 class="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          {{ systemStore.branding.heroTitle || 'Find & Synchronize Every Lyric' }}
        </h2>
        <p class="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
          {{ systemStore.branding.heroSubtitle || 'Explore over 780,000 synchronized tracks across isolated high-speed nodes with millisecond LRC accuracy.' }}
        </p>

        <!-- Search Bar Box -->
        <div class="pt-4 max-w-2xl mx-auto space-y-3">
          <div class="relative flex items-center">
            <Search class="w-5 h-5 absolute left-4 text-slate-400 pointer-events-none" />
            <input
              v-model="searchQuery"
              @input="onSearchInput"
              type="text"
              placeholder="Search by song title, artist, album, lyrics, or YouTube ID (e.g. yt:CwkzK-Fh400)..."
              class="w-full pl-12 pr-28 py-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 shadow-xl transition"
            />
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="absolute right-12 text-slate-400 hover:text-white p-1"
            >
              <X class="w-4 h-4" />
            </button>
            <div class="absolute right-3 flex items-center">
              <span class="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                ↵ Enter
              </span>
            </div>
          </div>

          <!-- Node Filter Pills -->
          <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              @click="selectedNodeFilter = 'all'"
              class="px-3.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              :class="selectedNodeFilter === 'all' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'"
            >
              <Layers class="w-3 h-3" />
              All Nodes (780k+)
            </button>
            <button
              v-for="node in systemStore.activeNodes"
              :key="node.node_id"
              @click="selectedNodeFilter = node.node_id"
              class="px-3.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              :class="selectedNodeFilter === node.node_id ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'"
            >
              <span>{{ node.node_id.toUpperCase() }}</span>
              <span v-if="node.is_nsfw" class="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300">NSFW</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- YouTube Direct Resolver Card -->
    <div class="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
          <Youtube class="w-6 h-6" />
        </div>
        <div>
          <h4 class="font-bold text-base text-white">YouTube Video ID Lyrics Cache</h4>
          <p class="text-xs text-slate-300 leading-relaxed">
            Directly lookup or synchronize lyrics by YouTube Video ID: <code class="text-violet-300 font-mono">youtubeVideoId → lyrics → timing/metadata → source → node</code>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 w-full md:w-auto">
        <input
          v-model="ytInput"
          type="text"
          placeholder="e.g. CwkzK-Fh400 or YouTube URL"
          class="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 w-full md:w-64 font-mono"
        />
        <button
          @click="resolveYouTubeId"
          :disabled="resolvingYt || !ytInput"
          class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-lg shadow-red-600/20"
        >
          <Zap class="w-3.5 h-3.5" />
          {{ resolvingYt ? 'Resolving...' : 'Resolve' }}
        </button>
      </div>
    </div>

    <!-- Trending Now Strip (v2.1) -->
    <div v-if="trending.length > 0 && !searchQuery" class="space-y-4">
      <div class="flex items-center gap-2.5">
        <TrendingUp class="w-5 h-5 text-pink-400" />
        <h3 class="text-xl font-black text-white">Trending Now</h3>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 uppercase">Live · by plays</span>
      </div>
      <div class="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
        <button
          v-for="(track, idx) in trending"
          :key="`trend-${track.node_id}-${track.id}`"
          @click="openKaraoke(track)"
          class="group shrink-0 w-56 text-left glass-card rounded-2xl p-4 transition-all duration-300 hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-950/40 relative overflow-hidden"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-2xl font-black text-slate-700 group-hover:text-pink-500/60 transition-colors font-mono">#{{ idx + 1 }}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-violet-500/15 text-violet-300 border border-violet-500/30">{{ track.node_id }}</span>
          </div>
          <h4 class="font-bold text-sm text-white truncate mt-2 group-hover:text-pink-300 transition-colors">{{ track.title }}</h4>
          <p class="text-xs text-slate-400 truncate">{{ track.artist }}</p>
          <div class="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
            <Eye class="w-3 h-3" />
            <span class="font-mono">{{ formatViews(track.views_count) }} plays</span>
            <Play class="w-3 h-3 ml-auto text-slate-600 group-hover:text-pink-400 transition-colors" />
          </div>
        </button>
      </div>
    </div>

    <!-- Lyrics Search Results or Top Catalog -->
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <Music class="w-5 h-5 text-violet-400" />
          <h3 class="text-xl font-black text-white">
            {{ searchQuery ? `Search Results for "${searchQuery}"` : 'Featured Synchronized Tracks' }}
          </h3>
          <span class="text-xs text-slate-400 font-medium">({{ filteredResults.length }} tracks)</span>
        </div>

        <div v-if="hasExplicitTracks" class="flex items-center gap-2 text-xs text-slate-400">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" v-model="showNsfw" class="rounded accent-rose-500" />
            <span>Show 18+ (PAKAI) Tracks</span>
          </label>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-16 text-center text-slate-500 flex flex-col items-center">
        <RefreshCw class="w-8 h-8 animate-spin text-violet-400 mb-2" />
        <p class="text-sm">Querying isolated node partitions...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredResults.length === 0" class="py-16 text-center glass-card rounded-2xl p-8 space-y-3">
        <Music class="w-12 h-12 text-slate-600 mx-auto" />
        <h4 class="font-bold text-white">No lyrics found</h4>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">
          We couldn't find any lyrics matching your query. Try searching by song name, artist, or YouTube video ID.
        </p>
        <router-link
          to="/submit"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition"
        >
          <Upload class="w-3.5 h-3.5" />
          Know these lyrics? Submit them
        </router-link>
      </div>

      <!-- Track Cards Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="track in filteredResults"
          :key="`${track.node_id}-${track.id}`"
          class="glass-card rounded-2xl p-5 flex flex-col justify-between group transition-all duration-300 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-950/40 relative overflow-hidden"
        >
          <!-- Track Header -->
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-base text-white truncate group-hover:text-violet-300 transition-colors">
                    {{ track.title }}
                  </h4>
                  <span
                    v-if="track.is_explicit"
                    class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0"
                  >
                    18+
                  </span>
                </div>
                <p class="text-xs text-slate-300 font-medium mt-0.5 truncate">{{ track.artist }}</p>
                <p v-if="track.album" class="text-[11px] text-slate-400 truncate mt-0.5">{{ track.album }}</p>
              </div>

              <!-- Node Pill -->
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0"
              >
                {{ track.node_id }}
              </span>
            </div>

            <!-- Lyric Snippet Preview -->
            <p class="text-xs text-slate-400 line-clamp-2 italic font-serif leading-relaxed bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
              "{{ getSnippet(track) }}"
            </p>

            <!-- Metadata tags -->
            <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <span v-if="track.duration" class="flex items-center gap-1 font-mono">
                <Clock class="w-3 h-3 text-slate-500" />
                {{ lyricsStore.formatTime(track.duration) }}
              </span>
              <span v-if="track.synced_lyrics" class="flex items-center gap-1 text-emerald-400 font-semibold">
                <Sparkles class="w-3 h-3" />
                LRC Synced
              </span>
              <span v-if="track.youtube_video_id" class="flex items-center gap-1 text-red-400 font-semibold font-mono">
                <Youtube class="w-3 h-3" />
                Cached
              </span>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <button
              @click="openKaraoke(track)"
              class="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-violet-600/20"
            >
              <Play class="w-3.5 h-3.5 fill-current" />
              Synchronize
            </button>

            <router-link
              :to="`/lyrics/${track.node_id}/${track.id}`"
              class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition flex items-center gap-1"
            >
              <Eye class="w-3.5 h-3.5" />
              View Track
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Karaoke Modal -->
    <Modal v-model="showKaraokeModal" :title="`${activeTrackModal?.title || ''} - ${activeTrackModal?.artist || ''}`" size="xl">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold shrink-0">
            <Music class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white">{{ activeTrackModal?.title }}</h3>
            <p class="text-xs text-slate-400">{{ activeTrackModal?.artist }} <span v-if="activeTrackModal?.album">• {{ activeTrackModal?.album }}</span></p>
          </div>
        </div>
      </template>

      <div class="h-[480px]">
        <NsfwGate v-if="activeTrackModal?.is_explicit">
          <SyncedLyrics />
        </NsfwGate>
        <SyncedLyrics v-else />
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSystemStore } from '../stores/system.store.js';
import { useLyricsStore } from '../stores/lyrics.store.js';
import SyncedLyrics from '../components/SyncedLyrics.vue';
import NsfwGate from '../components/NsfwGate.vue';
import Modal from '../components/Modal.vue';
import {
  Search,
  Sparkles,
  Layers,
  Youtube,
  Zap,
  Music,
  Clock,
  Play,
  Eye,
  RefreshCw,
  TrendingUp,
  Upload,
  X,
} from 'lucide-vue-next';

const systemStore = useSystemStore();
const lyricsStore = useLyricsStore();

const searchQuery = ref<string>('');
const selectedNodeFilter = ref<string>('all');
const showNsfw = ref<boolean>(false);
const loading = ref<boolean>(false);
const allResults = ref<any[]>([]);
const trending = ref<any[]>([]);
const ytInput = ref<string>('');
const resolvingYt = ref<boolean>(false);

const showKaraokeModal = ref<boolean>(false);
const activeTrackModal = ref<any>(null);

let debounceTimer: any = null;

onMounted(async () => {
  await fetchFeaturedTracks();
  await fetchTrending();
});

async function fetchTrending() {
  try {
    const res = await fetch('/api/v1/lyrics/trending?limit=8');
    const data = await res.json();
    if (data.results) {
      trending.value = data.results;
    }
  } catch {}
}

function formatViews(views: number): string {
  if (!views) return '0';
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'k';
  return String(views);
}

async function fetchFeaturedTracks() {
  loading.value = true;
  try {
    const res = await fetch('/api/v1/lyrics/search?limit=30&nsfw=true');
    const data = await res.json();
    if (data.results) {
      allResults.value = data.results;
    }
  } catch {} finally {
    loading.value = false;
  }
}

function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    executeSearch();
  }, 300);
}

async function executeSearch() {
  if (!searchQuery.value.trim()) {
    fetchFeaturedTracks();
    return;
  }
  loading.value = true;
  try {
    const res = await fetch(`/api/v1/lyrics/search?q=${encodeURIComponent(searchQuery.value)}&limit=30&nsfw=true`);
    const data = await res.json();
    if (data.results) {
      allResults.value = data.results;
    }
  } catch {} finally {
    loading.value = false;
  }
}

function clearSearch() {
  searchQuery.value = '';
  fetchFeaturedTracks();
}

async function resolveYouTubeId() {
  if (!ytInput.value) return;
  resolvingYt.value = true;
  let cleanId = ytInput.value.trim();

  // Extract from full youtube url if pasted
  const urlMatch = cleanId.match(/(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (urlMatch) {
    cleanId = urlMatch[1];
  }

  try {
    const res = await fetch(`/api/v1/lyrics/youtube/${cleanId}`);
    const data = await res.json();
    if (res.ok && data.lyrics) {
      allResults.value = [data.lyrics];
      openKaraoke(data.lyrics);
      systemStore.addToast('YouTube Lyrics Cache Hit!', `Resolved "${data.lyrics.title}" by ${data.lyrics.artist}`, 'success');
    } else {
      systemStore.addToast('Not Found in Cache', `No lyrics cached yet for YouTube ID "${cleanId}".`, 'warning');
    }
  } catch {
    systemStore.addToast('Resolution Error', 'Failed to reach YouTube resolver endpoint.', 'error');
  } finally {
    resolvingYt.value = false;
  }
}

const filteredResults = computed(() => {
  return allResults.value.filter((t) => {
    if (selectedNodeFilter.value !== 'all' && t.node_id !== selectedNodeFilter.value) {
      return false;
    }
    if (t.is_explicit && !showNsfw.value && selectedNodeFilter.value !== 'pakai') {
      return false;
    }
    return true;
  });
});

const hasExplicitTracks = computed(() => {
  return allResults.value.some((t) => t.is_explicit);
});

function getSnippet(track: any): string {
  if (track.plain_lyrics) {
    return track.plain_lyrics.split('\n').filter(Boolean).slice(0, 2).join(' / ');
  }
  if (track.synced_lyrics) {
    const parsed = lyricsStore.parseLrcText(track.synced_lyrics);
    if (parsed.length > 0) {
      return parsed.slice(0, 2).map((l) => l.text).join(' / ');
    }
  }
  return 'Synchronized audio transcript indexed in node.';
}

function openKaraoke(track: any) {
  activeTrackModal.value = track;
  lyricsStore.playSong(track);
  showKaraokeModal.value = true;
}
</script>
