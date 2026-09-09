<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-8">
    <!-- Header -->
    <div class="text-center max-w-2xl mx-auto space-y-3">
      <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold tracking-wide">
        <BrainCircuit class="w-3.5 h-3.5" />
        MIN-AI · AI for Lyrics
      </span>
      <h2 class="text-3xl sm:text-4xl font-black text-white tracking-tight">Generate, Find & Explore</h2>
      <p class="text-sm text-slate-400 leading-relaxed">
        A transparent Markov-chain engine trained only on this instance's catalog.
        No cloud AI, no external calls — every word it writes comes from lyrics you host.
      </p>
    </div>

    <!-- Status bar -->
    <div class="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0"
          :class="status?.trained ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'"
        ></span>
        <p class="text-xs text-slate-300">
          <template v-if="statusLoading">Checking model status...</template>
          <template v-else-if="status?.trained">
            Model trained on <strong class="text-white">{{ status.stats.tracks }} tracks</strong>
            · {{ status.stats.states }} states · order-{{ status.stats.order }}
          </template>
          <template v-else>
            <strong class="text-white">Model not trained yet.</strong>
            <span v-if="authStore.isAuthenticated"> Add lyrics to a node, then train below.</span>
            <span v-else> An admin can train it once lyrics exist.</span>
          </template>
        </p>
      </div>
      <button
        v-if="authStore.isAuthenticated"
        @click="trainModel"
        :disabled="training"
        class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="training ? 'animate-spin' : ''" />
        {{ training ? 'Training...' : status?.trained ? 'Retrain Model' : 'Train Model' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-2 border-b border-slate-800 pb-3">
      <button
        @click="tab = 'generate'"
        class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
        :class="tab === 'generate' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
      >
        <Wand2 class="w-4 h-4" />
        Generate Lyrics
      </button>
      <button
        @click="tab = 'finder'"
        class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
        :class="tab === 'finder' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
      >
        <ScanSearch class="w-4 h-4" />
        AI Finder
      </button>
    </div>

    <!-- ── Generate ── -->
    <div v-if="tab === 'generate'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-5 h-fit">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Seed word <span class="text-slate-500 font-normal">(optional)</span></label>
          <input
            v-model="gen.seed"
            type="text"
            placeholder="e.g. midnight"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Artist style <span class="text-slate-500 font-normal">(optional)</span></label>
          <input
            v-model="gen.artist"
            type="text"
            placeholder="e.g. LiSA"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
          <p class="text-[11px] text-slate-500 mt-1.5">Restricts the model to one artist's vocabulary.</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Lines: {{ gen.lines }}</label>
            <input v-model.number="gen.lines" type="range" min="1" max="12" class="w-full accent-violet-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Words/line: {{ gen.wordsPerLine }}</label>
            <input v-model.number="gen.wordsPerLine" type="range" min="4" max="12" class="w-full accent-violet-500" />
          </div>
        </div>

        <button
          @click="generate"
          :disabled="generating"
          class="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Wand2 class="w-4 h-4" />
          {{ generating ? 'Dreaming...' : 'Generate Lyrics' }}
        </button>

        <p v-if="genError" class="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">{{ genError }}</p>
      </div>

      <!-- Output -->
      <div class="lg:col-span-2">
        <div v-if="generating" class="glass-card rounded-3xl p-12 border border-slate-800 text-center">
          <RefreshCw class="w-8 h-8 animate-spin text-violet-400 mx-auto mb-3" />
          <p class="text-sm text-slate-400">Walking the Markov chain...</p>
        </div>

        <div v-else-if="generated" class="glass-panel rounded-3xl p-6 sm:p-8 border border-violet-500/30 space-y-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles class="w-4 h-4 text-violet-400" />
              <span>
                Original composition
                <span v-if="generated.artist"> in the style of <strong class="text-violet-300">{{ generated.artist }}</strong></span>
                <span v-if="generated.seed"> · seed “{{ generated.seed }}”</span>
              </span>
            </div>
            <button
              @click="copyGenerated"
              class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold transition flex items-center gap-1.5"
            >
              <Copy class="w-3 h-3" />
              Copy
            </button>
          </div>

          <div class="font-serif text-lg sm:text-xl text-slate-100 leading-loose whitespace-pre-line">{{ generated.lines.join('\n') }}</div>

          <div class="pt-4 border-t border-slate-800 flex items-center justify-between">
            <p class="text-[11px] text-slate-500">{{ generated.stats.states }} chain states · {{ generated.stats.vocab }} word vocabulary</p>
            <button @click="generate" class="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1.5">
              <Dices class="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        </div>

        <div v-else class="glass-card rounded-3xl p-12 border border-slate-800 text-center space-y-3">
          <Wand2 class="w-10 h-10 text-slate-600 mx-auto" />
          <h4 class="font-bold text-white">Nothing generated yet</h4>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Pick a seed word or artist style and press Generate. Untrained models train automatically on first use.</p>
        </div>
      </div>
    </div>

    <!-- ── Finder ── -->
    <div v-if="tab === 'finder'" class="space-y-6">
      <div class="max-w-2xl mx-auto space-y-3">
        <div class="relative">
          <ScanSearch class="w-5 h-5 absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
          <input
            v-model="finderQuery"
            @input="onFinderInput"
            type="text"
            placeholder="Describe a vibe — e.g. midnight city lights, heartbreak rain..."
            class="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 shadow-xl transition"
          />
        </div>
        <p class="text-[11px] text-slate-500 text-center">Ranked by lyric-vocabulary overlap — no embeddings, no black box.</p>
      </div>

      <div v-if="finding" class="py-12 text-center text-slate-500">
        <RefreshCw class="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
        <p class="text-xs">Scanning lyric vocabularies...</p>
      </div>

      <div v-else-if="finderResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <router-link
          v-for="r in finderResults"
          :key="`${r.track.node_id}-${r.track.id}`"
          :to="`/lyrics/${r.track.node_id}/${encodeURIComponent(r.track.id)}`"
          class="glass-card rounded-2xl p-5 border border-slate-800 hover:border-violet-500/50 transition group text-left"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h4 class="font-bold text-sm text-white truncate group-hover:text-violet-300">{{ r.track.title }}</h4>
              <p class="text-xs text-slate-400 truncate mt-0.5">{{ r.track.artist }}</p>
            </div>
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
              {{ Math.round(r.score * 100) }}%
            </span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
            <div class="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" :style="{ width: `${Math.min(100, Math.round(r.score * 100))}%` }"></div>
          </div>
          <p class="text-[11px] text-slate-400 italic font-serif mt-2.5 line-clamp-2">“{{ r.snippet }}”</p>
          <span class="text-[10px] font-mono text-slate-500 uppercase">{{ r.track.node_id }}</span>
        </router-link>
      </div>

      <div v-else-if="finderQuery.trim()" class="py-12 text-center glass-card rounded-2xl p-8">
        <p class="text-sm font-semibold text-white">No matches</p>
        <p class="text-xs text-slate-400 mt-1">Try different words — the Finder matches lyric vocabulary, not titles.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.store.js';
import { useSystemStore } from '../stores/system.store.js';
import {
  BrainCircuit,
  Wand2,
  ScanSearch,
  Sparkles,
  RefreshCw,
  Copy,
  Dices,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const systemStore = useSystemStore();

const tab = ref<'generate' | 'finder'>('generate');

// Status
const status = ref<any>(null);
const statusLoading = ref<boolean>(true);
const training = ref<boolean>(false);

// Generate
const gen = ref<any>({ seed: '', artist: '', lines: 4, wordsPerLine: 8 });
const generating = ref<boolean>(false);
const generated = ref<any>(null);
const genError = ref<string>('');

// Finder
const finderQuery = ref<string>('');
const finderResults = ref<any[]>([]);
const finding = ref<boolean>(false);
let finderTimer: any = null;

onMounted(fetchStatus);

async function fetchStatus() {
  statusLoading.value = true;
  try {
    const res = await fetch('/api/minai/status');
    const data = await res.json();
    if (data.minai) status.value = data.minai;
  } catch {} finally {
    statusLoading.value = false;
  }
}

async function trainModel() {
  training.value = true;
  genError.value = '';
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/minai/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('MIN-AI Trained', data.message, 'success');
      await fetchStatus();
    } else {
      systemStore.addToast('Training Failed', data.error || 'Could not train model.', 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    training.value = false;
  }
}

async function generate() {
  generating.value = true;
  genError.value = '';
  try {
    const res = await fetch('/api/minai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: gen.value.seed?.trim() || undefined,
        artist: gen.value.artist?.trim() || undefined,
        lines: gen.value.lines,
        wordsPerLine: gen.value.wordsPerLine,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      generated.value = data;
      if (!status.value?.trained) await fetchStatus();
    } else {
      genError.value = data.error || 'Generation failed';
    }
  } catch (err: any) {
    genError.value = err.message || 'Generation failed';
  } finally {
    generating.value = false;
  }
}

function copyGenerated() {
  if (!generated.value) return;
  navigator.clipboard.writeText(generated.value.lines.join('\n'));
  systemStore.addToast('Copied to clipboard!', '', 'success');
}

function onFinderInput() {
  clearTimeout(finderTimer);
  finderTimer = setTimeout(executeFinder, 400);
}

async function executeFinder() {
  const q = finderQuery.value.trim();
  if (!q) {
    finderResults.value = [];
    return;
  }
  finding.value = true;
  try {
    const res = await fetch(`/api/minai/finder?q=${encodeURIComponent(q)}&limit=12`);
    const data = await res.json();
    finderResults.value = data.results || [];
  } catch {
    finderResults.value = [];
  } finally {
    finding.value = false;
  }
}
</script>
