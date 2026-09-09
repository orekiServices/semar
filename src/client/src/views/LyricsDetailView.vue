<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-8 py-8">
    <div v-if="loading" class="py-24 text-center text-slate-500 flex flex-col items-center">
      <RefreshCw class="w-8 h-8 animate-spin text-violet-400 mb-2" />
      <p class="text-sm">Loading synchronized lyrics data...</p>
    </div>

    <div v-else-if="!song" class="py-24 text-center glass-card rounded-3xl p-8 max-w-md mx-auto space-y-4">
      <AlertCircle class="w-12 h-12 text-rose-500 mx-auto" />
      <h3 class="text-xl font-bold text-white">Song Not Found</h3>
      <p class="text-xs text-slate-400">The requested lyrics record does not exist in node "{{ $route.params.nodeId }}".</p>
      <router-link to="/" class="inline-flex px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold">
        Return Home
      </router-link>
    </div>

    <div v-else class="space-y-8">
      <!-- Top Track Hero Bar -->
      <div class="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="flex items-center gap-5">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-white shadow-xl shrink-0 overflow-hidden border border-white/10">
              <img
                v-if="song.youtube_video_id"
                :src="`https://i.ytimg.com/vi/${song.youtube_video_id}/hqdefault.jpg`"
                :alt="song.title"
                class="w-full h-full object-cover"
              />
              <Music v-else class="w-10 h-10 text-white/80" />
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2.5">
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Node: {{ song.node_id }}
                </span>
                <span v-if="song.is_explicit" class="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  18+ Explicit
                </span>
              </div>
              <h2 class="text-2xl sm:text-4xl font-black text-white tracking-tight">{{ song.title }}</h2>
              <p class="text-sm sm:text-base text-slate-300 font-medium">{{ song.artist }} <span v-if="song.album" class="text-slate-400 font-normal">• {{ song.album }}</span></p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-2.5">
            <button
              @click="lyricsStore.playSong(song)"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              <Play class="w-4 h-4 fill-current" />
              Play in Sync Dock
            </button>

            <a
              v-if="song.youtube_video_id"
              :href="`https://www.youtube.com/watch?v=${song.youtube_video_id}`"
              target="_blank"
              rel="noopener"
              class="px-4 py-2.5 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Youtube class="w-4 h-4" />
              YouTube Video
            </a>

            <button
              @click="downloadLrc"
              class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 transition flex items-center gap-1.5"
            >
              <Download class="w-4 h-4 text-violet-400" />
              Export .LRC
            </button>

            <button
              @click="downloadTtml"
              class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 transition flex items-center gap-1.5"
            >
              <Download class="w-4 h-4 text-pink-400" />
              Export .TTML
            </button>
          </div>
        </div>
      </div>

      <div v-if="isSpecial" class="glass-card rounded-2xl p-4 border border-cyan-500/30 flex items-center gap-3 text-xs text-slate-300">
        <Globe class="w-4 h-4 text-cyan-400 shrink-0" />
        <span>Live from the <strong class="text-cyan-300">{{ song.node_id }}</strong> external library — read-only, lyrics belong to their respective owners.</span>
      </div>

      <!-- Main Lyrics Card -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl h-[560px]">
        <NsfwGate v-if="song.is_explicit">
          <SyncedLyrics />
        </NsfwGate>
        <SyncedLyrics v-else />
      </div>

      <!-- More Like This (MIN-AI similarity) -->
      <div v-if="similar.length > 0" class="glass-card rounded-2xl p-6 border border-slate-800">
        <h4 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-violet-400" />
          More Like This
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <router-link
            v-for="s in similar"
            :key="`${s.track.node_id}-${s.track.id}`"
            :to="`/lyrics/${s.track.node_id}/${encodeURIComponent(s.track.id)}`"
            class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 hover:border-violet-500/40 transition group"
          >
            <h5 class="text-xs font-bold text-white truncate group-hover:text-violet-300">{{ s.track.title }}</h5>
            <p class="text-[11px] text-slate-400 truncate mt-0.5">{{ s.track.artist }}</p>
            <span class="text-[10px] font-mono text-slate-500 uppercase">{{ s.track.node_id }} · {{ Math.round(s.score * 100) }}% match</span>
          </router-link>
        </div>
      </div>

      <!-- Extended Metadata Inspector -->
      <div v-if="song.metadata && Object.keys(song.metadata).length > 0" class="glass-card rounded-2xl p-6 border border-slate-800">
        <h4 class="font-bold text-sm text-white mb-3 flex items-center gap-2">
          <Database class="w-4 h-4 text-violet-400" />
          Track Attributes & Metadata
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div v-for="(val, key) in song.metadata" :key="key" class="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span class="text-slate-400 block text-[10px] uppercase">{{ key }}</span>
            <span class="text-violet-200 font-semibold truncate block mt-0.5">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLyricsStore } from '../stores/lyrics.store.js';
import { useSystemStore } from '../stores/system.store.js';
import SyncedLyrics from '../components/SyncedLyrics.vue';
import NsfwGate from '../components/NsfwGate.vue';
import { Music, Play, Youtube, Download, RefreshCw, AlertCircle, Database, Globe, Sparkles } from 'lucide-vue-next';

const route = useRoute();
const lyricsStore = useLyricsStore();
const systemStore = useSystemStore();

const song = ref<any>(null);
const loading = ref<boolean>(true);
const similar = ref<any[]>([]);

const isSpecial = computed(() => ['lrclib', 'lyricsovh'].includes((song.value?.node_id || '').toLowerCase()));

onMounted(loadTrack);
watch(() => [route.params.nodeId, route.params.id], loadTrack);

async function loadTrack() {
  const nodeId = route.params.nodeId as string;
  const id = route.params.id as string;
  loading.value = true;
  similar.value = [];
  try {
    const res = await fetch(`/api/v1/lyrics/${nodeId}/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.lyrics) {
      song.value = data.lyrics;
      lyricsStore.playSong(data.lyrics);
      fetchSimilar(nodeId, id);
    }
  } catch {} finally {
    loading.value = false;
  }
}

async function fetchSimilar(nodeId: string, id: string) {
  try {
    const res = await fetch(`/api/minai/similar/${nodeId}/${encodeURIComponent(id)}?limit=4`);
    const data = await res.json();
    if (data.results) similar.value = data.results;
  } catch {}
}

function downloadLrc() {
  if (!song.value?.synced_lyrics) return;
  const blob = new Blob([song.value.synced_lyrics], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${song.value.artist} - ${song.value.title}.lrc`;
  a.click();
  URL.revokeObjectURL(url);
  systemStore.addToast('LRC Exported', 'Downloaded synchronized lyrics file.', 'success');
}

function downloadTtml() {
  if (!song.value?.ttml_lyrics) {
    systemStore.addToast('No TTML available', '', 'warning');
    return;
  }
  const blob = new Blob([song.value.ttml_lyrics], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${song.value.artist} - ${song.value.title}.ttml`;
  a.click();
  URL.revokeObjectURL(url);
  systemStore.addToast('TTML Exported', 'Downloaded Apple Music compliant TTML lyrics file.', 'success');
}
</script>
