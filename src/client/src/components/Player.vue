<template>
  <div
    v-if="lyricsStore.activeSong"
    class="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800/90 backdrop-blur-xl shadow-2xl px-4 sm:px-8 py-3 transition-transform"
  >
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
      <!-- Track Info -->
      <div class="flex items-center gap-3.5 min-w-0 w-full sm:w-1/3">
        <div class="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60 shadow-md">
          <img
            v-if="thumbnailUrl"
            :src="thumbnailUrl"
            :alt="lyricsStore.activeSong.title"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/30 to-pink-600/30 text-violet-300">
            <Music class="w-5 h-5" />
          </div>
          <div v-if="lyricsStore.isPlaying" class="absolute bottom-1 right-1 flex items-end gap-0.5 h-3">
            <span class="w-1 bg-violet-400 rounded-full animate-[bounce_0.6s_infinite] h-2"></span>
            <span class="w-1 bg-pink-400 rounded-full animate-[bounce_0.8s_infinite] h-3"></span>
            <span class="w-1 bg-violet-400 rounded-full animate-[bounce_0.5s_infinite] h-1.5"></span>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-sm text-white truncate">{{ lyricsStore.activeSong.title }}</h4>
            <span
              v-if="lyricsStore.activeSong.node_id"
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0"
            >
              {{ lyricsStore.activeSong.node_id }}
            </span>
            <span
              v-if="lyricsStore.activeSong.is_explicit"
              class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0"
            >
              18+
            </span>
          </div>
          <p class="text-xs text-slate-400 truncate">{{ lyricsStore.activeSong.artist }} <span v-if="lyricsStore.activeSong.album">• {{ lyricsStore.activeSong.album }}</span></p>
        </div>
      </div>

      <!-- Playback Controls & Progress Bar -->
      <div class="flex flex-col items-center gap-1.5 w-full sm:w-1/3">
        <div class="flex items-center gap-4">
          <button
            @click="lyricsStore.seek(Math.max(0, lyricsStore.currentTime - 5))"
            class="text-slate-400 hover:text-white transition p-1"
            title="Rewind 5s"
          >
            <RotateCcw class="w-4 h-4" />
          </button>

          <button
            @click="lyricsStore.togglePlay"
            class="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 transition transform hover:scale-105 active:scale-95"
          >
            <component :is="lyricsStore.isPlaying ? Pause : Play" class="w-5 h-5 fill-current" />
          </button>

          <button
            @click="lyricsStore.seek(Math.min(lyricsStore.duration, lyricsStore.currentTime + 5))"
            class="text-slate-400 hover:text-white transition p-1"
            title="Forward 5s"
          >
            <RotateCw class="w-4 h-4" />
          </button>
        </div>

        <!-- Scrubber -->
        <div class="w-full flex items-center gap-2.5">
          <span class="text-[11px] font-mono text-slate-400 w-10 text-right">
            {{ lyricsStore.formatTime(lyricsStore.currentTime) }}
          </span>
          <div class="relative flex-1 group py-1 cursor-pointer">
            <input
              type="range"
              min="0"
              :max="lyricsStore.duration || 200"
              step="0.5"
              :value="lyricsStore.currentTime"
              @input="onSeek"
              class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500 group-hover:h-2 transition-all"
            />
          </div>
          <span class="text-[11px] font-mono text-slate-400 w-10">
            {{ lyricsStore.formatTime(lyricsStore.duration) }}
          </span>
        </div>
      </div>

      <!-- Extra Actions -->
      <div class="flex items-center justify-end gap-2.5 w-full sm:w-1/3">
        <!-- Speed button -->
        <button
          @click="cycleSpeed"
          class="px-2 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          title="Playback Speed"
        >
          {{ lyricsStore.playbackSpeed }}x
        </button>

        <!-- YouTube direct link if available -->
        <a
          v-if="lyricsStore.activeSong.youtube_video_id"
          :href="`https://www.youtube.com/watch?v=${lyricsStore.activeSong.youtube_video_id}`"
          target="_blank"
          rel="noopener"
          class="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 hover:text-red-300 transition flex items-center gap-1.5 text-xs font-semibold"
          title="Watch on YouTube"
        >
          <Youtube class="w-4 h-4" />
          <span class="hidden md:inline">YouTube</span>
        </a>

        <!-- Close player -->
        <button
          @click="closePlayer"
          class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Dismiss Player"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLyricsStore } from '../stores/lyrics.store.js';
import { Play, Pause, RotateCcw, RotateCw, Music, Youtube, X } from 'lucide-vue-next';

const lyricsStore = useLyricsStore();

const thumbnailUrl = computed(() => {
  if (lyricsStore.activeSong?.youtube_video_id) {
    return `https://i.ytimg.com/vi/${lyricsStore.activeSong.youtube_video_id}/hqdefault.jpg`;
  }
  return null;
});

function onSeek(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  lyricsStore.seek(val);
}

function cycleSpeed() {
  const speeds = [1, 1.25, 1.5, 0.75];
  const currentIdx = speeds.indexOf(lyricsStore.playbackSpeed);
  lyricsStore.playbackSpeed = speeds[(currentIdx + 1) % speeds.length];
}

function closePlayer() {
  lyricsStore.pause();
  lyricsStore.activeSong = null;
}
</script>
