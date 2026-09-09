<template>
  <div class="am-lyrics-wrapper relative h-full flex flex-col rounded-2xl overflow-hidden select-none">
    <!-- Fluid background ambient effect -->
    <div class="absolute inset-0 bg-gradient-to-b from-violet-950/40 via-slate-950/70 to-slate-950 pointer-events-none z-0"></div>

    <!-- am-lyrics Web Component -->
    <div class="relative z-10 flex-1 overflow-hidden h-full flex flex-col">
      <am-lyrics
        ref="amLyricsRef"
        class="w-full h-full block"
        :ttml="activeTtml"
        :current-time="currentTimeMs"
        :duration="durationMs"
        :song-title="lyricsStore.activeSong?.title || 'Song'"
        :song-artist="lyricsStore.activeSong?.artist || 'Artist'"
        :highlight-color="highlightColor"
        autoscroll
        interpolate
        @line-click="handleLineClick"
      ></am-lyrics>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLyricsStore } from '../stores/lyrics.store.js';

const props = withDefaults(
  defineProps<{
    highlightColor?: string;
  }>(),
  {
    highlightColor: '#ffffff',
  }
);

const lyricsStore = useLyricsStore();
const amLyricsRef = ref<HTMLElement | null>(null);

const activeTtml = computed(() => {
  if (lyricsStore.activeSong?.ttml_lyrics) {
    return lyricsStore.activeSong.ttml_lyrics;
  }
  // Synthesize TTML if only synced_lyrics present
  if (lyricsStore.activeSong?.synced_lyrics) {
    const title = lyricsStore.activeSong.title || 'Track';
    const artist = lyricsStore.activeSong.artist || 'Artist';
    const dur = lyricsStore.activeSong.duration || 200;
    return generateClientTtml(lyricsStore.activeSong.synced_lyrics, title, artist, dur);
  }
  return '';
});

const currentTimeMs = computed(() => {
  return Math.floor((lyricsStore.currentTime || 0) * 1000);
});

const durationMs = computed(() => {
  return Math.floor((lyricsStore.duration || 200) * 1000);
});

function handleLineClick(e: any) {
  if (e && e.detail && typeof e.detail.timestamp === 'number') {
    const targetSeconds = e.detail.timestamp / 1000;
    lyricsStore.seek(targetSeconds);
    if (!lyricsStore.isPlaying) {
      lyricsStore.resume();
    }
  }
}

function generateClientTtml(lrc: string, title: string, artist: string, durSecs: number): string {
  const lines = lrc.split('\n');
  const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  let pXml = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    timeReg.lastIndex = 0;
    const match = timeReg.exec(raw);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10)) : 0;
      const beginSecs = mins * 60 + secs + ms / 1000;
      const clean = raw.replace(timeReg, '').trim();

      const m = Math.floor(beginSecs / 60);
      const s = Math.floor(beginSecs % 60);
      const milli = Math.floor((beginSecs % 1) * 1000);
      const beginFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${milli.toString().padStart(3, '0')}`;
      
      const endSecs = beginSecs + 4.0;
      const em = Math.floor(endSecs / 60);
      const es = Math.floor(endSecs % 60);
      const emilli = Math.floor((endSecs % 1) * 1000);
      const endFormatted = `${em.toString().padStart(2, '0')}:${es.toString().padStart(2, '0')}.${emilli.toString().padStart(3, '0')}`;

      pXml += `      <p begin="${beginFormatted}" end="${endFormatted}" ttm:agent="v1"><span>${escapeXml(clean)}</span></p>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:title>${escapeXml(title)}</ttm:title>
      <ttm:agent type="person" xml:id="v1">${escapeXml(artist)}</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
${pXml}
    </div>
  </body>
</tt>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
</script>

<style scoped>
am-lyrics {
  --am-lyrics-highlight-color: #ffffff;
  --am-lyrics-line-height: 1.35;
  --am-lyrics-line-spacing: 24px;
  --am-lyrics-font-size-base: 32px;
  --am-lyrics-inline-padding: 16px;
  --am-lyrics-progression-feather: 28px;
  --am-lyrics-highlight-radius: 16px;
  --am-lyrics-highlight-surface: rgba(139, 92, 246, 0.15);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
</style>
