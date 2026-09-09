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
                {{ node.node_id }} {{ node.is_special ? '· External' : 'Partition' }}
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
            <div v-if="!node.is_special" class="flex justify-between"><span class="text-slate-400">Isolated Table:</span><span class="text-violet-300 font-semibold">{{ node.table_name }}</span></div>
            <div v-else class="flex justify-between"><span class="text-slate-400">Source:</span><span class="text-cyan-300 font-semibold">live · read-only</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Rate Limit:</span><span class="text-emerald-400 font-semibold">{{ node.rate_limit }} rpm</span></div>
          </div>
        </div>

        <!-- Node About Info -->
        <div v-if="node.about_config && (node.about_config.maintainer || node.about_config.curationRules)" class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 text-xs">
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

      <!-- Special node: live provider search -->
      <div v-if="node.is_special" class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            <Search class="w-5 h-5 text-cyan-400" />
            Search {{ node.name }}
          </h3>
          <span class="text-xs text-slate-400">{{ tracks.length }} result{{ tracks.length === 1 ? '' : 's' }}</span>
        </div>

        <div class="relative max-w-xl">
          <Search class="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            v-model="providerQuery"
            @input="onProviderInput"
            type="text"
            :placeholder="`Search ${node.node_id} — e.g. Coldplay Yellow...`"
            class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div v-if="searching" class="py-12 text-center text-slate-500">
          <RefreshCw class="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
          <p class="text-xs">Querying external library...</p>
        </div>

        <div v-else-if="providerQuery && tracks.length === 0" class="py-12 text-center glass-card rounded-2xl p-8">
          <p class="text-sm font-semibold text-white">No matches in {{ node.name }}</p>
          <p class="text-xs text-slate-400 mt-1">Try a different title, artist, or spelling.</p>
        </div>

        <div v-else-if="!providerQuery" class="py-12 text-center glass-card rounded-2xl p-8">
          <p class="text-sm text-slate-300">Type above to search millions of community tracks live.</p>
          <p class="text-xs text-slate-500 mt-1">Results open as read-only lyric pages.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="t in tracks"
            :key="`${t.node_id}-${t.id}`"
            class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-cyan-500/40 transition flex flex-col justify-between space-y-3"
          >
            <div>
              <h4 class="font-bold text-white text-sm truncate">{{ t.title }}</h4>
              <p class="text-xs text-slate-400 mt-0.5">{{ t.artist }}</p>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <button
                @click="lyricsStore.playSong(t)"
                class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1"
              >
                <Play class="w-3 h-3 fill-current" /> Play Sync
              </button>
              <router-link
                :to="`/lyrics/${node.node_id}/${encodeURIComponent(t.id)}`"
                class="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                View Full →
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Local node tracklist -->
      <NsfwGate v-else-if="node.is_nsfw">
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

        <div v-if="tracks.length === 0" class="py-12 text-center glass-card rounded-2xl p-8">
          <p class="text-sm font-semibold text-white">This node is empty</p>
          <p class="text-xs text-slate-400 mt-1">Import lyrics from the admin panel or submit the first track.</p>
          <router-link to="/submit" class="inline-block mt-3 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition">
            Submit Lyrics
          </router-link>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
import { RefreshCw, Music, Play, Search } from 'lucide-vue-next';

const route = useRoute();
const lyricsStore = useLyricsStore();

const node = ref<any>(null);
const tracks = ref<any[]>([]);
const loading = ref<boolean>(true);
const providerQuery = ref<string>('');
const searching = ref<boolean>(false);
let providerTimer: any = null;

onMounted(async () => {
  const nodeId = route.params.nodeId as string;
  try {
    const resNode = await fetch(`/api/v1/nodes/${nodeId}`);
    const dataNode = await resNode.json();
    node.value = dataNode.node;

    // Special nodes have no local catalog — they search live instead
    if (!dataNode.node?.is_special) {
      const resTracks = await fetch(`/api/v1/nodes/${nodeId}/lyrics?limit=50`);
      const dataTracks = await resTracks.json();
      tracks.value = dataTracks.lyrics || [];
    }
  } catch {} finally {
    loading.value = false;
  }
});

function onProviderInput() {
  clearTimeout(providerTimer);
  providerTimer = setTimeout(executeProviderSearch, 400);
}

async function executeProviderSearch() {
  const nodeId = route.params.nodeId as string;
  const q = providerQuery.value.trim();
  if (!q) {
    tracks.value = [];
    return;
  }
  searching.value = true;
  try {
    const res = await fetch(`/api/v1/nodes/${nodeId}/lyrics?q=${encodeURIComponent(q)}&limit=24`);
    const data = await res.json();
    tracks.value = data.lyrics || [];
  } catch {
    tracks.value = [];
  } finally {
    searching.value = false;
  }
}
</script>
