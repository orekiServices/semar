<template>
  <div class="flex flex-col h-full">
    <!-- View Switcher & Action bar -->
    <div class="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-800/80 shrink-0 gap-2">
      <!-- Mode Tabs -->
      <div class="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
        <button
          @click="mode = 'am-lyrics'"
          class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          :class="mode === 'am-lyrics' ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-md shadow-pink-600/30' : 'text-slate-400 hover:text-white'"
        >
          <Sparkles class="w-3.5 h-3.5 text-pink-300" />
          Apple Music (TTML)
        </button>
        <button
          @click="mode = 'synced'"
          class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          :class="mode === 'synced' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-400 hover:text-white'"
        >
          <Radio class="w-3.5 h-3.5" />
          Classic LRC
        </button>
        <button
          @click="mode = 'plain'"
          class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          :class="mode === 'plain' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-400 hover:text-white'"
        >
          <AlignLeft class="w-3.5 h-3.5" />
          Plain
        </button>
        <button
          @click="mode = 'xml'"
          class="px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1"
          :class="mode === 'xml' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-400 hover:text-white'"
        >
          <Code2 class="w-3.5 h-3.5" />
          TTML XML
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <button
          v-if="mode === 'synced'"
          @click="autoScroll = !autoScroll"
          class="px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1"
          :class="autoScroll ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'"
          title="Toggle Auto-Scroll"
        >
          <Compass class="w-3.5 h-3.5" />
          Scroll: {{ autoScroll ? 'ON' : 'OFF' }}
        </button>
        <button
          @click="downloadTtml"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/80"
        >
          <Download class="w-3.5 h-3.5 text-pink-400" />
          .TTML
        </button>
        <button
          @click="copyLyrics"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/80"
        >
          <Copy class="w-3.5 h-3.5" />
          Copy
        </button>
      </div>
    </div>

    <!-- 1. Apple Music Style am-lyrics View -->
    <div v-if="mode === 'am-lyrics'" class="flex-1 overflow-hidden h-full">
      <AmLyricsPlayer />
    </div>

    <!-- 2. Classic Synchronized (LRC) View -->
    <div
      v-else-if="mode === 'synced'"
      ref="lyricsContainer"
      class="flex-1 overflow-y-auto px-4 py-8 space-y-6 scroll-smooth text-center select-none"
    >
      <div v-if="lyricsStore.parsedLrc.length === 0" class="py-16 text-slate-500 flex flex-col items-center">
        <Music class="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
        <p class="text-sm font-medium">No synchronized LRC timestamps available for this track.</p>
        <button
          @click="mode = 'plain'"
          class="mt-3 text-xs text-violet-400 hover:text-violet-300 underline font-semibold"
        >
          Switch to Plain Text
        </button>
      </div>

      <div
        v-for="(line, idx) in lyricsStore.parsedLrc"
        :key="idx"
        :ref="(el) => { if (idx === lyricsStore.currentLineIndex) activeLineEl = el }"
        @click="seekTo(line.timeSeconds)"
        class="group cursor-pointer transition-all duration-300 py-2 px-4 rounded-2xl max-w-2xl mx-auto"
        :class="[
          idx === lyricsStore.currentLineIndex
            ? 'scale-105 font-bold text-white bg-violet-950/40 border border-violet-500/30 shadow-lg shadow-violet-900/20 backdrop-blur-sm'
            : idx < lyricsStore.currentLineIndex
            ? 'text-slate-400 opacity-60 hover:opacity-100 hover:text-slate-200'
            : 'text-slate-400 opacity-80 hover:opacity-100 hover:text-slate-200 hover:bg-slate-800/40'
        ]"
      >
        <div class="flex items-center justify-center gap-2">
          <span
            v-if="idx === lyricsStore.currentLineIndex"
            class="w-2 h-2 rounded-full bg-violet-400 animate-ping inline-block shrink-0"
          ></span>
          <p
            class="transition-all tracking-wide"
            :class="[
              idx === lyricsStore.currentLineIndex
                ? 'text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-violet-200 via-pink-200 to-white'
                : 'text-lg sm:text-xl font-medium'
            ]"
          >
            {{ line.text }}
          </p>
        </div>
        <span class="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition mt-1 block">
          {{ line.timeFormatted }} • click to seek
        </span>
      </div>
    </div>

    <!-- 3. Plain Lyrics View -->
    <div
      v-else-if="mode === 'plain'"
      class="flex-1 overflow-y-auto px-6 py-6 text-slate-200 whitespace-pre-line leading-relaxed text-base font-normal max-w-3xl mx-auto font-sans"
    >
      {{ plainLyricsText }}
    </div>

    <!-- 4. Raw TTML XML Inspector -->
    <div
      v-else-if="mode === 'xml'"
      class="flex-1 overflow-y-auto p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-violet-200 whitespace-pre selection:bg-violet-900"
    >
      {{ activeTtmlXml }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useLyricsStore } from '../stores/lyrics.store.js';
import { useSystemStore } from '../stores/system.store.js';
import AmLyricsPlayer from './AmLyricsPlayer.vue';
import { Sparkles, Radio, AlignLeft, Code2, Copy, Compass, Download, Music } from 'lucide-vue-next';

const lyricsStore = useLyricsStore();
const systemStore = useSystemStore();

const mode = ref<'am-lyrics' | 'synced' | 'plain' | 'xml'>('am-lyrics');
const autoScroll = ref<boolean>(true);
const lyricsContainer = ref<HTMLElement | null>(null);
const activeLineEl = ref<any>(null);

const plainLyricsText = computed(() => {
  if (lyricsStore.activeSong?.plain_lyrics) {
    return lyricsStore.activeSong.plain_lyrics;
  }
  if (lyricsStore.parsedLrc.length > 0) {
    return lyricsStore.parsedLrc.map((l) => l.text).join('\n');
  }
  return 'No lyrics transcript available for this song.';
});

const activeTtmlXml = computed(() => {
  if (lyricsStore.activeSong?.ttml_lyrics) {
    return lyricsStore.activeSong.ttml_lyrics;
  }
  return '<!-- No TTML XML loaded -->';
});

function seekTo(timeSecs: number) {
  lyricsStore.seek(timeSecs);
  if (!lyricsStore.isPlaying) {
    lyricsStore.resume();
  }
}

function copyLyrics() {
  const text = mode.value === 'xml' ? activeTtmlXml.value : plainLyricsText.value;
  navigator.clipboard.writeText(text);
  systemStore.addToast('Copied to clipboard!', '', 'success');
}

function downloadTtml() {
  const xml = activeTtmlXml.value;
  if (!xml || xml.startsWith('<!--')) {
    systemStore.addToast('No TTML available', '', 'warning');
    return;
  }
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${lyricsStore.activeSong?.artist || 'Artist'} - ${lyricsStore.activeSong?.title || 'Song'}.ttml`;
  a.click();
  URL.revokeObjectURL(url);
  systemStore.addToast('TTML Downloaded', 'Exported Apple Music compliant TTML file.', 'success');
}

// Watch active line and smoothly scroll into center for LRC mode
watch(
  () => lyricsStore.currentLineIndex,
  async (newIdx) => {
    if (!autoScroll.value || mode.value !== 'synced' || newIdx === -1) return;
    await nextTick();
    if (activeLineEl.value && lyricsContainer.value) {
      activeLineEl.value.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }
);
</script>
