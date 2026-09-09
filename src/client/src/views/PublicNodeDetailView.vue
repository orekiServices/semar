<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
    <div v-if="loading" class="py-24 text-center text-slate-500">
      <RefreshCw class="w-8 h-8 animate-spin text-violet-400 mx-auto mb-2" />
      <p class="text-sm">Loading node partition...</p>
    </div>

    <div v-else-if="!node" class="py-24 text-center glass-card rounded-3xl p-8 max-w-md mx-auto">
      <h3 class="text-xl font-bold text-white">Node Not Found</h3>
      <p class="text-xs text-slate-400 mt-2">The requested node does not exist.</p>
    </div>

    <div v-else class="space-y-8">
      <!-- Node Banner & About Hero -->
      <div class="glass-panel rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <div class="flex items-center gap-2.5">
              <span class="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase">
                {{ node.node_id }} Partition
              </span>
              <span v-if="node.is_nsfw" class="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                18+ Age Restricted
              </span>
            </div>
            <h2 class="text-2xl sm:text-4xl font-black text-white tracking-tight">{{ node.name }}</h2>
            <p class="text-sm text-slate-300 leading-relaxed">{{ node.description }}</p>
          </div>

          <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 text-xs font-mono space-y-2 shrink-0 min-w-[220px]">
            <div class="flex justify-between"><span class="text-slate-400">Total Scale:</span><span class="text-white font-bold">{{ node.total_records_approx?.toLocaleString() }}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Isolated Table:</span><span class="text-violet-300 font-semibold">{{ node.table_name }}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Rate Limit:</span><span class="text-emerald-400 font-semibold">{{ node.rate_limit }} rpm</span></div>
          </div>
        </div>

        <!-- Node About Info -->
        <div v-if="node.about_config" class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 text-xs">
          <div v-if="node.about_config.maintainer" class="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800">
            <span class="text-slate-400 font-bold uppercase text-[10px] block mb-1">Curation Team</span>
            <p class="text-white font-semibold">{{ node.about_config.maintainer }}</p>
          </div>
          <div v-if="node.about_config.curationRules" class="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800 md:col-span-2">
            <span class="text-slate-400 font-bold uppercase text-[10px] block mb-1">Curation & Sync Standard</span>
            <p class="text-slate-300 leading-relaxed">{{ node.about_config.curationRules }}</p>
          </div>
        </div>
      </div>

      <!-- Node Tracklist -->
      <NsfwGate v-if="node.is_nsfw">
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              <Music class="w-5 h-5 text-violet-400" />
              Indexed Tracks in {{ node.name }}
            </h3>
            <span class="text-xs text-slate-400">{{ tracks.length }} loaded</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="t in tracks"
              :key="t.id"
              class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-violet-500/40 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <h4 class="font-bold text-white text-sm truncate">{{ t.title }}</h4>
                <p class="text-xs text-slate-400 mt-0.5">{{ t.artist }}</p>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <button
                  @click="lyricsStore.playSong(t)"
                  class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition flex items-center gap-1"
                >
                  <Play class="w-3 h-3 fill-current" /> Play Sync
                </button>
                <router-link
                  :to="`/lyrics/${node.node_id}/${t.id}`"
                  class="text-xs text-violet-400 hover:text-violet-300 font-medium"
                >
                  View Full →
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </NsfwGate>

      <!-- Non-NSFW Tracklist -->
      <div v-else class="space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            <Music class="w-5 h-5 text-violet-400" />
            Indexed Tracks in {{ node.name }}
          </h3>
          <span class="text-xs text-slate-400">{{ tracks.length }} loaded</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="t in tracks"
            :key="t.id"
            class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-violet-500/40 transition flex flex-col justify-between space-y-3"
          >
            <div>
              <h4 class="font-bold text-white text-sm truncate">{{ t.title }}</h4>
              <p class="text-xs text-slate-400 mt-0.5">{{ t.artist }}</p>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <button
                @click="lyricsStore.playSong(t)"
                class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition flex items-center gap-1"
              >
                <Play class="w-3 h-3 fill-current" /> Play Sync
              </button>
              <router-link
                :to="`/lyrics/${node.node_id}/${t.id}`"
                class="text-xs text-violet-400 hover:text-violet-300 font-medium"
              >
                View Full →
              </router-link>
            </div>
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
import NsfwGate from '../components/NsfwGate.vue';
import { RefreshCw, Music, Play } from 'lucide-vue-next';

const route = useRoute();
const lyricsStore = useLyricsStore();

const node = ref<any>(null);
const tracks = ref<any[]>([]);
const loading = ref<boolean>(true);

onMounted(async () => {
  const nodeId = route.params.nodeId as string;
  try {
    const resNode = await fetch(`/api/v1/nodes/${nodeId}`);
    const dataNode = await resNode.json();
    node.value = dataNode.node;

    const resTracks = await fetch(`/api/v1/nodes/${nodeId}/lyrics?limit=50`);
    const dataTracks = await resTracks.json();
    tracks.value = dataTracks.lyrics || [];
  } catch {} finally {
    loading.value = false;
  }
});
</script>
