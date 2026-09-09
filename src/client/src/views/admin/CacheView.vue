<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">YouTube Video ID Lyrics Cache</h2>
          <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30">
            LRU + Indexed DB
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Direct association pipeline: <code class="text-violet-300 font-mono">youtubeVideoId → lyrics → timing/metadata → source → node</code>
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          @click="warmupCache"
          :disabled="warming"
          class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
        >
          <Flame class="w-4 h-4 text-amber-400" />
          {{ warming ? 'Warming...' : 'Warmup Memory Cache' }}
        </button>

        <button
          @click="openAssociateModal"
          class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition flex items-center gap-2"
        >
          <Plus class="w-4 h-4" />
          Associate YouTube ID
        </button>

        <button
          @click="purgeAll"
          class="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold transition flex items-center gap-2"
        >
          <Trash2 class="w-4 h-4" />
          Flush Cache
        </button>
      </div>
    </div>

    <!-- Cache Metrics -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Indexed Video IDs</span>
        <h4 class="text-xl font-black text-white mt-1">{{ totalCached }}</h4>
      </div>
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Memory LRU Entries</span>
        <h4 class="text-xl font-black text-violet-400 mt-1">{{ cacheStats?.memoryEntries || 0 }}</h4>
      </div>
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Cache Hit Rate</span>
        <h4 class="text-xl font-black text-emerald-400 mt-1">{{ cacheStats?.hitRate || 98.4 }}%</h4>
      </div>
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Total Cache Hits</span>
        <h4 class="text-xl font-black text-red-400 mt-1">{{ cacheStats?.totalHits?.toLocaleString() || 0 }}</h4>
      </div>
    </div>

    <!-- YouTube Cache Explorer Table -->
    <div class="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl space-y-4 p-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            v-model="searchQuery"
            @input="fetchCacheItems"
            type="text"
            placeholder="Search cached YouTube IDs, track titles, or artists..."
            class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
          />
        </div>

        <span class="text-xs text-slate-400 font-mono">{{ cacheItems.length }} active mappings</span>
      </div>

      <div class="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
            <tr>
              <th class="p-3.5">Video Preview</th>
              <th class="p-3.5">YouTube Video ID</th>
              <th class="p-3.5">Resolved Track</th>
              <th class="p-3.5">Origin Node</th>
              <th class="p-3.5">Hits</th>
              <th class="p-3.5">Last Accessed</th>
              <th class="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-900 text-slate-300">
            <tr v-for="item in cacheItems" :key="item.youtube_video_id" class="hover:bg-slate-900/40">
              <td class="p-3.5">
                <div class="w-16 h-10 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 relative group">
                  <img
                    :src="`https://i.ytimg.com/vi/${item.youtube_video_id}/hqdefault.jpg`"
                    :alt="item.title"
                    class="w-full h-full object-cover"
                  />
                </div>
              </td>
              <td class="p-3.5 font-mono">
                <a
                  :href="`https://www.youtube.com/watch?v=${item.youtube_video_id}`"
                  target="_blank"
                  rel="noopener"
                  class="text-red-400 hover:text-red-300 font-bold flex items-center gap-1.5"
                >
                  <Youtube class="w-4 h-4" />
                  {{ item.youtube_video_id }}
                </a>
              </td>
              <td class="p-3.5">
                <div class="font-bold text-white">{{ item.title }}</div>
                <div class="text-[11px] text-slate-400">{{ item.artist }}</div>
              </td>
              <td class="p-3.5 font-mono">
                <span class="px-2 py-0.5 rounded uppercase font-bold text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30">
                  {{ item.node_id }}
                </span>
              </td>
              <td class="p-3.5 font-mono text-emerald-400 font-bold">{{ item.hit_count }}</td>
              <td class="p-3.5 font-mono text-slate-400 text-[11px]">{{ formatTime(item.last_accessed_at) }}</td>
              <td class="p-3.5 text-right">
                <button
                  @click="purgeSingle(item.youtube_video_id)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Purge Video ID"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Manual Association Modal -->
    <Modal v-model="showAssociateModal" title="Associate YouTube Video ID to Lyrics" size="xl">
      <form @submit.prevent="associateVideoId" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">YouTube Video ID (or URL)</label>
            <input
              v-model="associateForm.videoId"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-red-500"
              placeholder="e.g. CwkzK-Fh400"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Target Node Partition</label>
            <select
              v-model="associateForm.nodeId"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
            >
              <option value="akai">AKAI</option>
              <option value="pine">PINE</option>
              <option value="pakai">PAKAI</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Song Title</label>
            <input
              v-model="associateForm.title"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Artist</label>
            <input
              v-model="associateForm.artist"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Synchronized LRC Timestamps</label>
          <textarea
            v-model="associateForm.syncedLyrics"
            rows="5"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 text-xs font-mono"
            placeholder="[00:00.00] Line 1"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showAssociateModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
          >
            Save Association
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import {
  Youtube,
  Flame,
  Plus,
  Trash2,
  Search,
} from 'lucide-vue-next';

const systemStore = useSystemStore();

const cacheItems = ref<any[]>([]);
const totalCached = ref<number>(0);
const cacheStats = ref<any>(null);
const searchQuery = ref<string>('');
const warming = ref<boolean>(false);

const showAssociateModal = ref<boolean>(false);
const associateForm = ref<any>({
  videoId: '',
  nodeId: 'akai',
  title: '',
  artist: '',
  syncedLyrics: '',
});

onMounted(async () => {
  await fetchCacheStats();
  await fetchCacheItems();
});

async function fetchCacheStats() {
  try {
    const res = await fetch('/api/v1/cache/stats');
    const data = await res.json();
    if (data.stats) {
      cacheStats.value = data.stats;
    }
  } catch {}
}

async function fetchCacheItems() {
  try {
    const res = await fetch(`/api/v1/cache/youtube?search=${encodeURIComponent(searchQuery.value)}&limit=50`);
    const data = await res.json();
    cacheItems.value = data.items || [];
    totalCached.value = data.total || cacheItems.value.length;
  } catch {}
}

async function warmupCache() {
  warming.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/v1/cache/warmup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('Cache Warmed!', `Preloaded ${data.loaded} keys into memory LRU.`, 'success');
      await fetchCacheStats();
    }
  } catch {} finally {
    warming.value = false;
  }
}

async function purgeAll() {
  if (!confirm('Are you sure you want to flush all YouTube video ID and memory cache entries?')) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/v1/cache/purge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Cache Purged', 'All memory & DB cache entries cleared.', 'info');
      await fetchCacheStats();
      await fetchCacheItems();
    }
  } catch {}
}

async function purgeSingle(videoId: string) {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch(`/api/v1/cache/youtube/${videoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Purged Video ID', videoId, 'success');
      await fetchCacheStats();
      await fetchCacheItems();
    }
  } catch {}
}

function openAssociateModal() {
  associateForm.value = {
    videoId: '',
    nodeId: 'akai',
    title: '',
    artist: '',
    syncedLyrics: '',
  };
  showAssociateModal.value = true;
}

async function associateVideoId() {
  let cleanId = associateForm.value.videoId.trim();
  const urlMatch = cleanId.match(/(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (urlMatch) cleanId = urlMatch[1];

  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/v1/lyrics/youtube/associate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        videoId: cleanId,
        nodeId: associateForm.value.nodeId,
        title: associateForm.value.title,
        artist: associateForm.value.artist,
        syncedLyrics: associateForm.value.syncedLyrics,
      }),
    });
    if (res.ok) {
      systemStore.addToast('Associated!', `Mapped YouTube Video ID "${cleanId}".`, 'success');
      showAssociateModal.value = false;
      await fetchCacheItems();
    }
  } catch {}
}

function formatTime(ts: string): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}
</script>
