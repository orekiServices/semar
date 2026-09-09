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

      <!-- Main Lyrics Card -->
      <div class="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl h-[560px]">
        <NsfwGate v-if="song.is_explicit">
          <SyncedLyrics />
        </NsfwGate>
        <SyncedLyrics v-else />
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
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useLyricsStore } from '../stores/lyrics.store.js';
import { useSystemStore } from '../stores/system.store.js';
import SyncedLyrics from '../components/SyncedLyrics.vue';
import NsfwGate from '../components/NsfwGate.vue';
import { Music, Play, Youtube, Download, RefreshCw, AlertCircle, Database } from 'lucide-vue-next';

const route = useRoute();
const lyricsStore = useLyricsStore();
const systemStore = useSystemStore();

const song = ref<any>(null);
const loading = ref<boolean>(true);

onMounted(async () => {
  const nodeId = route.params.nodeId as string;
  const id = route.params.id as string;
  try {
    const res = await fetch(`/api/v1/lyrics/${nodeId}/${id}`);
    const data = await res.json();
    if (data.lyrics) {
      song.value = data.lyrics;
      lyricsStore.playSong(data.lyrics);
    }
  } catch {} finally {
    loading.value = false;
  }
});

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
