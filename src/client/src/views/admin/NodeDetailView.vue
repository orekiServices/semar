<template>
  <div class="space-y-8">
    <div v-if="loading" class="py-24 text-center text-slate-500">
      <RefreshCw class="w-8 h-8 animate-spin text-violet-400 mx-auto mb-2" />
      <p class="text-sm">Loading node metadata & partition stats...</p>
    </div>

    <div v-else-if="!node" class="py-24 text-center glass-card rounded-3xl p-8 max-w-md mx-auto">
      <h3 class="text-xl font-bold text-white">Node Not Found</h3>
    </div>

    <div v-else class="space-y-8">
      <!-- Node Header & Switcher Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase">
              {{ node.node_id }}
            </span>
            <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">{{ node.name }}</h2>
          </div>
          <p class="text-xs text-slate-400 mt-1">Isolated Table: <code class="text-violet-300 font-mono">{{ node.table_name }}</code> • Rate limit: {{ node.rate_limit }} rpm</p>
        </div>

        <!-- Node Selector Dropdown -->
        <div class="flex items-center gap-2">
          <select
            :value="node.node_id"
            @change="$router.push(`/admin/nodes/${$event.target.value}`)"
            class="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-violet-500"
          >
            <option v-for="n in allNodes" :key="n.node_id" :value="n.node_id">
              {{ n.node_id.toUpperCase() }} - {{ n.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          @click="tab = 'lyrics'"
          class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
          :class="tab === 'lyrics' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
        >
          <Music class="w-4 h-4" />
          Isolated Lyrics Table ({{ totalLyrics }})
        </button>
        <button
          @click="tab = 'about'"
          class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
          :class="tab === 'about' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
        >
          <Info class="w-4 h-4" />
          Node About & Rules
        </button>
        <button
          @click="tab = 'config'"
          class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
          :class="tab === 'config' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white bg-slate-900'"
        >
          <Sliders class="w-4 h-4" />
          Node Settings & Limits
        </button>
      </div>

      <!-- Tab: Isolated Lyrics Table -->
      <div v-if="tab === 'lyrics'" class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="relative flex-1 max-w-md">
            <Search class="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              v-model="lyricsQuery"
              @input="searchLyrics"
              type="text"
              placeholder="Search songs inside this node table..."
              class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
            />
          </div>

          <button
            @click="openAddLyricsModal"
            class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center gap-2 shrink-0"
          >
            <Plus class="w-4 h-4" />
            Add Track to {{ node.node_id.toUpperCase() }}
          </button>
        </div>

        <!-- Table -->
        <div class="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 shadow-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
              <tr>
                <th class="p-3">ID</th>
                <th class="p-3">Title & Artist</th>
                <th class="p-3">Album</th>
                <th class="p-3">YouTube Video ID</th>
                <th class="p-3">Sync LRC</th>
                <th class="p-3">TTML (Apple Music)</th>
                <th class="p-3">Views</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-900 text-slate-300">
              <tr v-for="track in lyricsList" :key="track.id" class="hover:bg-slate-900/40">
                <td class="p-3 font-mono text-slate-400">#{{ track.id }}</td>
                <td class="p-3">
                  <div class="font-bold text-white">{{ track.title }}</div>
                  <div class="text-slate-400 text-[11px]">{{ track.artist }}</div>
                </td>
                <td class="p-3 text-slate-400">{{ track.album || '-' }}</td>
                <td class="p-3 font-mono">
                  <span v-if="track.youtube_video_id" class="text-red-400 flex items-center gap-1">
                    <Youtube class="w-3.5 h-3.5" />
                    {{ track.youtube_video_id }}
                  </span>
                  <span v-else class="text-slate-600">-</span>
                </td>
                <td class="p-3">
                  <span v-if="track.synced_lyrics" class="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles class="w-3 h-3" /> Yes
                  </span>
                  <span v-else class="text-slate-600">Plain only</span>
                </td>
                <td class="p-3">
                  <span v-if="track.ttml_lyrics" class="text-pink-400 font-bold flex items-center gap-1">
                    <Sparkles class="w-3 h-3 text-pink-300" /> TTML Syllables
                  </span>
                  <span v-else class="text-slate-600">Auto-gen</span>
                </td>
                <td class="p-3 font-mono">{{ track.views_count?.toLocaleString() || 0 }}</td>
                <td class="p-3 text-right">
                  <button
                    @click="deleteTrack(track.id)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab: About & Rules -->
      <div v-if="tab === 'about'" class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-6">
        <h3 class="text-base font-bold text-white">Node Public About Configuration</h3>

        <form @submit.prevent="saveAboutConfig" class="space-y-4 max-w-2xl">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tagline</label>
            <input
              v-model="aboutForm.tagline"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Maintainer / Curation Team</label>
            <input
              v-model="aboutForm.maintainer"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Curation & Sync Standard Rules</label>
            <textarea
              v-model="aboutForm.curationRules"
              rows="3"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
            ></textarea>
          </div>

          <button
            type="submit"
            :disabled="saving"
            class="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center gap-2"
          >
            <Save class="w-4 h-4" />
            {{ saving ? 'Saving...' : 'Save About Configuration' }}
          </button>
        </form>
      </div>

      <!-- Tab: Config & Limits -->
      <div v-if="tab === 'config'" class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-6">
        <h3 class="text-base font-bold text-white">Node Limits & Flags</h3>

        <form @submit.prevent="saveNodeConfig" class="space-y-4 max-w-2xl">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Node Name</label>
            <input
              v-model="configForm.name"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5">Rate Limit (rpm)</label>
              <input
                v-model="configForm.rate_limit"
                type="number"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5">Approximate Scale</label>
              <input
                v-model="configForm.total_records_approx"
                type="number"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
            <input
              type="checkbox"
              id="node_nsfw_flag"
              v-model="configForm.is_nsfw"
              class="rounded accent-rose-500 w-4 h-4"
            />
            <label for="node_nsfw_flag" class="text-xs text-slate-300 font-semibold cursor-pointer">
              NSFW / Mature Isolation Enabled
            </label>
          </div>

          <button
            type="submit"
            :disabled="saving"
            class="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center gap-2"
          >
            <Save class="w-4 h-4" />
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Add Track Modal -->
    <Modal v-model="showAddTrackModal" :title="`Add Lyrics to ${node?.node_id?.toUpperCase()}`" size="xl">
      <form @submit.prevent="addTrack" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Title</label>
            <input
              v-model="trackForm.title"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Artist</label>
            <input
              v-model="trackForm.artist"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Album</label>
            <input
              v-model="trackForm.album"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">YouTube Video ID</label>
            <input
              v-model="trackForm.youtube_video_id"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="e.g. CwkzK-Fh400"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Synchronized LRC Lyrics ([mm:ss.xx] timestamps)</label>
          <textarea
            v-model="trackForm.synced_lyrics"
            rows="6"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 text-xs font-mono focus:outline-none focus:border-violet-500"
            placeholder="[00:00.00] Line 1&#10;[00:05.20] Line 2"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showAddTrackModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
          >
            Insert Track
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import {
  Music,
  Info,
  Sliders,
  Search,
  Plus,
  Trash2,
  Save,
  Youtube,
  Sparkles,
  RefreshCw,
} from 'lucide-vue-next';

const route = useRoute();
const systemStore = useSystemStore();

const node = ref<any>(null);
const allNodes = ref<any[]>([]);
const lyricsList = ref<any[]>([]);
const totalLyrics = ref<number>(0);
const loading = ref<boolean>(true);
const tab = ref<'lyrics' | 'about' | 'config'>('lyrics');
const lyricsQuery = ref<string>('');
const saving = ref<boolean>(false);

const aboutForm = ref<any>({});
const configForm = ref<any>({});

const showAddTrackModal = ref<boolean>(false);
const trackForm = ref<any>({
  title: '',
  artist: '',
  album: '',
  youtube_video_id: '',
  synced_lyrics: '',
  plain_lyrics: '',
});

onMounted(loadNodeData);
watch(() => route.params.id, loadNodeData);

async function loadNodeData() {
  const nodeId = route.params.id as string;
  if (!nodeId) return;
  loading.value = true;
  try {
    const resAll = await fetch('/api/v1/nodes');
    const dataAll = await resAll.json();
    allNodes.value = dataAll.nodes || [];

    const resNode = await fetch(`/api/v1/nodes/${nodeId}`);
    const dataNode = await resNode.json();
    node.value = dataNode.node;
    aboutForm.value = { ...(dataNode.node.about_config || {}) };
    configForm.value = {
      name: dataNode.node.name,
      rate_limit: dataNode.node.rate_limit,
      total_records_approx: dataNode.node.total_records_approx,
      is_nsfw: dataNode.node.is_nsfw,
    };

    await fetchNodeLyrics();
  } catch {} finally {
    loading.value = false;
  }
}

async function fetchNodeLyrics() {
  const nodeId = route.params.id as string;
  try {
    const res = await fetch(`/api/v1/nodes/${nodeId}/lyrics?q=${encodeURIComponent(lyricsQuery.value)}&limit=50`);
    const data = await res.json();
    lyricsList.value = data.lyrics || [];
    totalLyrics.value = data.total || lyricsList.value.length;
  } catch {}
}

function searchLyrics() {
  fetchNodeLyrics();
}

function openAddLyricsModal() {
  trackForm.value = {
    title: '',
    artist: '',
    album: '',
    youtube_video_id: '',
    synced_lyrics: '',
    plain_lyrics: '',
  };
  showAddTrackModal.value = true;
}

async function addTrack() {
  try {
    const token = localStorage.getItem('semar_token');
    const nodeId = route.params.id as string;
    const res = await fetch(`/api/v1/nodes/${nodeId}/lyrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(trackForm.value),
    });
    if (res.ok) {
      systemStore.addToast('Track Added', 'Saved lyrics to node table.', 'success');
      showAddTrackModal.value = false;
      await fetchNodeLyrics();
    }
  } catch {}
}

async function deleteTrack(id: number) {
  if (!confirm('Delete this lyrics record?')) return;
  try {
    const token = localStorage.getItem('semar_token');
    const nodeId = route.params.id as string;
    const res = await fetch(`/api/v1/lyrics/${nodeId}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Track Deleted', '', 'success');
      await fetchNodeLyrics();
    }
  } catch {}
}

async function saveAboutConfig() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const nodeId = route.params.id as string;
    const res = await fetch(`/api/v1/nodes/${nodeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ about_config: aboutForm.value }),
    });
    if (res.ok) {
      systemStore.addToast('Saved', 'Node about info updated.', 'success');
    }
  } catch {} finally {
    saving.value = false;
  }
}

async function saveNodeConfig() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const nodeId = route.params.id as string;
    const res = await fetch(`/api/v1/nodes/${nodeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(configForm.value),
    });
    if (res.ok) {
      systemStore.addToast('Saved', 'Node configuration updated.', 'success');
      await loadNodeData();
    }
  } catch {} finally {
    saving.value = false;
  }
}
</script>
