<template>
  <div class="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-950 flex flex-col shadow-xl">
    <!-- Toolbar -->
    <div class="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
        <span class="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
        <span class="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
        <span class="text-xs font-mono font-semibold text-slate-300 ml-2">{{ filename || 'handler.js' }}</span>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">Node.js VM Sandbox</span>
      </div>

      <div class="flex items-center gap-2">
        <!-- Templates dropdown -->
        <select
          @change="insertTemplate($event)"
          class="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-violet-500"
        >
          <option value="">⚡ Load Code Template...</option>
          <option value="nodeQuery">Query a Node Partition</option>
          <option value="ytBridge">YouTube Cache Resolver</option>
          <option value="searchGlobal">Global Multi-Node Search</option>
          <option value="webhookIngest">Curator Webhook Ingest</option>
          <option value="customTransform">JSON Transformation & Filter</option>
          <option value="minaiGenerate">MIN-AI Lyric Generator</option>
        </select>

        <button
          @click="copyCode"
          class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1"
          title="Copy Code"
        >
          <Copy class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Code Area with Line Numbers -->
    <div class="relative flex flex-1 min-h-[280px] max-h-[500px] overflow-hidden font-mono text-xs">
      <!-- Line Numbers Column -->
      <div class="w-12 py-3 bg-slate-900/50 border-r border-slate-800/60 text-slate-600 text-right pr-3 select-none overflow-hidden shrink-0">
        <div v-for="n in lineCount" :key="n" class="leading-5 h-5">{{ n }}</div>
      </div>

      <!-- Textarea Editor -->
      <textarea
        ref="textareaEl"
        :value="modelValue"
        @input="onInput"
        @keydown.tab.prevent="insertTab"
        spellcheck="false"
        class="flex-1 w-full bg-transparent p-3 text-violet-200 focus:outline-none resize-none leading-5 font-mono overflow-y-auto whitespace-pre selection:bg-violet-900 selection:text-white"
        placeholder="// Write your SemAPI handler(ctx) JavaScript code here..."
      ></textarea>
    </div>

    <!-- Footer helper -->
    <div class="px-4 py-1.5 bg-slate-900/80 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
      <span>Available APIs: ctx.params, ctx.query, ctx.body, ctx.db, ctx.nodes, ctx.lyrics, ctx.minai, ctx.cache, ctx.log()</span>
      <span>Lines: {{ lineCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Copy } from 'lucide-vue-next';
import { useSystemStore } from '../stores/system.store.js';

const props = defineProps<{
  modelValue: string;
  filename?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const systemStore = useSystemStore();
const textareaEl = ref<HTMLTextAreaElement | null>(null);

const lineCount = computed(() => {
  return (props.modelValue || '').split('\n').length || 1;
});

function onInput(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value;
  emit('update:modelValue', val);
}

function insertTab(e: KeyboardEvent) {
  const textarea = textareaEl.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  const newVal = val.substring(0, start) + '  ' + val.substring(end);
  emit('update:modelValue', newVal);

  setTimeout(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 2;
  }, 0);
}

function copyCode() {
  navigator.clipboard.writeText(props.modelValue || '');
  systemStore.addToast('Copied code to clipboard!', '', 'success');
}

const templates: Record<string, string> = {
  nodeQuery: `// Query specific isolated node partition
async function handler(ctx) {
  const query = ctx.query.q || '';
  const nodeId = ctx.params.nodeId || (await ctx.db.query('SELECT node_id FROM nodes LIMIT 1'))[0]?.node_id;
  
  ctx.log(\`Searching node "\${nodeId}" for: "\${query}"\`);
  const results = await ctx.nodes.searchLyrics(nodeId, query, 15);
  
  return ctx.json({
    status: 'success',
    node: nodeId,
    total: results.length,
    results
  });
}`,
  ytBridge: `// YouTube Video ID Cache Resolver
async function handler(ctx) {
  const videoId = ctx.params.videoId || ctx.query.yt;
  if (!videoId) {
    return ctx.error('Missing YouTube Video ID', 400);
  }

  ctx.log(\`Resolving YouTube Video ID: \${videoId}\`);
  const lyrics = await ctx.lyrics.getByYouTubeId(videoId);
  
  if (!lyrics) {
    return ctx.status(404).json({ error: 'Video ID not found in cache' });
  }

  return ctx.json({
    status: 'success',
    source: 'youtube_lyrics_cache',
    lyrics
  });
}`,
  searchGlobal: `// Multi-Node Global Lyrics Search
async function handler(ctx) {
  const q = ctx.query.q || '';
  const limit = Math.min(parseInt(ctx.query.limit || '10', 10), 50);

  ctx.log(\`Global query across all active nodes: \${q}\`);
  const hits = await ctx.lyrics.searchAll(q, limit);

  return ctx.json({
    status: 'success',
    query: q,
    count: hits.length,
    hits
  });
}`,
  webhookIngest: `// Automated Curator Ingest Webhook
async function handler(ctx) {
  const { nodeId, title, artist, plainLyrics, syncedLyrics, duration, youtubeVideoId } = ctx.body || {};

  if (!nodeId || !title || !artist) {
    return ctx.error('nodeId, title, and artist are required', 400);
  }

  ctx.log(\`Ingesting "\${title}" by \${artist} into node \${nodeId}\`);
  const res = await ctx.lyrics.saveLyrics(nodeId, {
    title,
    artist,
    plainLyrics,
    syncedLyrics,
    duration,
    youtubeVideoId
  });

  return ctx.status(201).json({
    status: 'created',
    songId: res.insertId,
    nodeId
  });
}`,
  customTransform: `// Custom JSON Transformation & Filter
async function handler(ctx) {
  const nodes = await ctx.nodes.listNodes();

  const summary = nodes.map(n => ({
    node: n.node_id,
    name: n.name,
    external: Boolean(n.is_special)
  }));

  return ctx.json({
    nodeSummary: summary
  });
}`,
  minaiGenerate: `// MIN-AI Lyric Generator (v2.2+)
async function handler(ctx) {
  const seed = ctx.query.seed || '';
  const lines = Math.min(parseInt(ctx.query.lines || '4', 10), 12);

  ctx.log(\`Generating \${lines} lines (seed: "\${seed}")\`);
  const poem = await ctx.minai.generate({ seed, lines });

  return ctx.json({
    status: 'success',
    trained: poem.trained,
    lines: poem.lines
  });
}`,
};

function insertTemplate(e: Event) {
  const sel = (e.target as HTMLSelectElement).value;
  if (sel && templates[sel]) {
    emit('update:modelValue', templates[sel]);
    systemStore.addToast('Template loaded into editor', '', 'info');
  }
  (e.target as HTMLSelectElement).value = '';
}
</script>
