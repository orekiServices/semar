<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Lyrics Database Explorer</h2>
        <p class="text-xs text-slate-400 mt-1">Global catalog explorer across all partitioned node tables with synchronized LRC editor and bulk tools.</p>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          @click="openImportModal"
          class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-2"
        >
          <Upload class="w-4 h-4 text-violet-400" />
          Bulk Import
        </button>
        <button
          @click="exportNodeLyrics"
          class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-2"
        >
          <Download class="w-4 h-4 text-pink-400" />
          Export JSON
        </button>
        <button
          @click="openCreateModal"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
        >
          <Plus class="w-4 h-4" />
          New Lyrics Record
        </button>
      </div>
    </div>

    <!-- Search & Node Filter Bar -->
    <div class="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
      <div class="relative flex-1 w-full">
        <Search class="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          v-model="searchQuery"
          @input="onSearch"
          type="text"
          placeholder="Search all lyrics tables by title, artist, album, or YouTube ID..."
          class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <select
          v-model="selectedNode"
          @change="fetchLyrics"
          class="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-violet-500 font-mono w-full sm:w-auto"
        >
          <option value="all">All Partitions</option>
          <option v-for="n in nodes" :key="n.node_id" :value="n.node_id">
            Node: {{ n.node_id.toUpperCase() }}
          </option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="border border-slate-800 rounded-3xl overflow-hidden bg-slate-950 shadow-2xl">
      <div v-if="loading" class="p-12 text-center text-slate-500">
        <RefreshCw class="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
        <p class="text-xs">Querying lyrics partitions...</p>
      </div>

      <div v-else-if="lyricsList.length === 0" class="p-12 text-center text-slate-400 space-y-2">
        <Music class="w-10 h-10 text-slate-600 mx-auto" />
        <p class="text-sm font-semibold text-white">No lyrics records found</p>
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
          <tr>
            <th class="p-3.5">Node</th>
            <th class="p-3.5">Song Title & Artist</th>
            <th class="p-3.5">Album</th>
            <th class="p-3.5">YouTube ID</th>
            <th class="p-3.5">Duration</th>
            <th class="p-3.5">LRC Sync</th>
            <th class="p-3.5">Views</th>
            <th class="p-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900 text-slate-300">
          <tr v-for="track in lyricsList" :key="`${track.node_id}-${track.id}`" class="hover:bg-slate-900/40">
            <td class="p-3.5 font-mono">
              <span class="px-2 py-0.5 rounded uppercase font-bold text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {{ track.node_id }}
              </span>
            </td>
            <td class="p-3.5">
              <div class="font-bold text-white flex items-center gap-2">
                {{ track.title }}
                <span v-if="track.is_explicit" class="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">18+</span>
              </div>
              <div class="text-slate-400 text-[11px]">{{ track.artist }}</div>
            </td>
            <td class="p-3.5 text-slate-400">{{ track.album || '-' }}</td>
            <td class="p-3.5 font-mono">
              <span v-if="track.youtube_video_id" class="text-red-400 flex items-center gap-1">
                <Youtube class="w-3.5 h-3.5" />
                {{ track.youtube_video_id }}
              </span>
              <span v-else class="text-slate-600">-</span>
            </td>
            <td class="p-3.5 font-mono text-slate-400">
              {{ track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '-' }}
            </td>
            <td class="p-3.5">
              <span v-if="track.synced_lyrics" class="text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles class="w-3 h-3" /> Synced
              </span>
              <span v-else class="text-slate-500">Plain</span>
            </td>
            <td class="p-3.5 font-mono text-slate-300">{{ track.views_count?.toLocaleString() || 0 }}</td>
            <td class="p-3.5 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button
                  @click="openEditModal(track)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Edit Track"
                >
                  <Edit3 class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="deleteTrack(track)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Delete Track"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / Edit Lyrics Record Modal -->
    <Modal v-model="showEditModal" :title="isEditing ? 'Edit Lyrics Record' : 'Add New Lyrics Record'" size="2xl">
      <form @submit.prevent="saveTrack" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Target Node Partition</label>
            <select
              v-model="trackForm.node_id"
              :disabled="isEditing"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
            >
              <option v-for="n in nodes" :key="n.node_id" :value="n.node_id">
                {{ n.node_id.toUpperCase() }} ({{ n.name }})
              </option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Song Title</label>
            <input
              v-model="trackForm.title"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Artist</label>
            <input
              v-model="trackForm.artist"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

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

        <!-- Lyrics Format Tabs in Form -->
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="lyricsTab = 'synced'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition"
                :class="lyricsTab === 'synced' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'"
              >
                LRC Timestamps
              </button>
              <button
                type="button"
                @click="lyricsTab = 'ttml'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
                :class="lyricsTab === 'ttml' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'"
              >
                <Sparkles class="w-3 h-3" />
                Apple Music TTML
              </button>
              <button
                type="button"
                @click="lyricsTab = 'plain'"
                class="px-3 py-1 rounded-lg text-xs font-bold transition"
                :class="lyricsTab === 'plain' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'"
              >
                Plain Text
              </button>
            </div>

            <button
              v-if="lyricsTab === 'synced' && trackForm.synced_lyrics"
              type="button"
              @click="generateTtmlFromLrc"
              class="text-[11px] font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1"
            >
              <Sparkles class="w-3 h-3" /> Convert to TTML XML
            </button>
          </div>

          <div v-show="lyricsTab === 'synced'">
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Synchronized LRC [mm:ss.xx]</label>
            <textarea
              v-model="trackForm.synced_lyrics"
              rows="6"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="[00:00.00] Track Intro&#10;[00:04.12] First line of lyrics"
            ></textarea>
          </div>

          <div v-show="lyricsTab === 'ttml'">
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">TTML XML (Apple Music Word/Syllable Timing Schema)</label>
            <textarea
              v-model="trackForm.ttml_lyrics"
              rows="8"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-pink-200 text-xs font-mono focus:outline-none focus:border-pink-500"
              placeholder="<tt xmlns='http://www.w3.org/ns/ttml'>&#10;  <body>...</body>&#10;</tt>"
            ></textarea>
          </div>

          <div v-show="lyricsTab === 'plain'">
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Plain Lyrics Text</label>
            <textarea
              v-model="trackForm.plain_lyrics"
              rows="5"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showEditModal = false"
            class="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-violet-600/30"
          >
            {{ saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Insert Lyrics') }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Bulk Import Modal -->
    <Modal v-model="showImportModal" title="Bulk Import Lyrics to Node" size="xl">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Target Node Partition</label>
          <select
            v-model="importTargetNode"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
          >
            <option v-for="n in nodes" :key="n.node_id" :value="n.node_id">{{ n.node_id.toUpperCase() }} ({{ n.name }})</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">JSON Dataset (Array of Track Objects)</label>
          <textarea
            v-model="importJson"
            rows="8"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 text-xs font-mono"
            placeholder='[ { "title": "Example", "artist": "Singer", "synced_lyrics": "[00:00.00] ..." } ]'
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            @click="showImportModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            @click="runBulkImport"
            class="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs"
          >
            Import Records
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import {
  Search,
  Plus,
  Upload,
  Download,
  Music,
  Youtube,
  Sparkles,
  Edit3,
  Trash2,
  RefreshCw,
} from 'lucide-vue-next';

const systemStore = useSystemStore();

const nodes = ref<any[]>([]);
const lyricsList = ref<any[]>([]);
const searchQuery = ref<string>('');
const selectedNode = ref<string>('all');
const loading = ref<boolean>(true);

// Edit modal
const showEditModal = ref<boolean>(false);
const isEditing = ref<boolean>(false);
const saving = ref<boolean>(false);
const lyricsTab = ref<'synced' | 'ttml' | 'plain'>('synced');
const trackForm = ref<any>({
  id: undefined,
  node_id: 'akai',
  title: '',
  artist: '',
  album: '',
  youtube_video_id: '',
  duration: 0,
  plain_lyrics: '',
  synced_lyrics: '',
  ttml_lyrics: '',
  is_explicit: false,
});

// Import modal
const showImportModal = ref<boolean>(false);
const importTargetNode = ref<string>('akai');
const importJson = ref<string>('[\n  {\n    "title": "Sample Song",\n    "artist": "Sample Artist",\n    "album": "Sample Album",\n    "synced_lyrics": "[00:00.00] Intro\\n[00:05.00] First Verse"\n  }\n]');

onMounted(async () => {
  await fetchNodes();
  await fetchLyrics();
});

async function fetchNodes() {
  try {
    const res = await fetch('/api/v1/nodes');
    const data = await res.json();
    nodes.value = data.nodes || [];
  } catch {}
}

async function fetchLyrics() {
  loading.value = true;
  try {
    let url = `/api/v1/lyrics/search?limit=100&nsfw=true`;
    if (searchQuery.value) {
      url += `&q=${encodeURIComponent(searchQuery.value)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    let results = data.results || [];
    if (selectedNode.value !== 'all') {
      results = results.filter((r: any) => r.node_id === selectedNode.value);
    }
    lyricsList.value = results;
  } catch {} finally {
    loading.value = false;
  }
}

function onSearch() {
  fetchLyrics();
}

function openCreateModal() {
  isEditing.value = false;
  lyricsTab.value = 'synced';
  trackForm.value = {
    id: undefined,
    node_id: nodes.value[0]?.node_id || 'akai',
    title: '',
    artist: '',
    album: '',
    youtube_video_id: '',
    duration: 180,
    plain_lyrics: '',
    synced_lyrics: '',
    ttml_lyrics: '',
    is_explicit: false,
  };
  showEditModal.value = true;
}

function openEditModal(track: any) {
  isEditing.value = true;
  lyricsTab.value = 'synced';
  trackForm.value = { ...track };
  showEditModal.value = true;
}

function generateTtmlFromLrc() {
  if (!trackForm.value.synced_lyrics) return;
  const lrc = trackForm.value.synced_lyrics;
  const title = trackForm.value.title || 'Track';
  const artist = trackForm.value.artist || 'Artist';
  const dur = trackForm.value.duration || 200;

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

      // Syllables
      const words = clean.split(' ').filter(Boolean);
      let spans = '';
      if (words.length > 0) {
        const step = 4.0 / words.length;
        words.forEach((w: string, widx: number) => {
          const wb = beginSecs + widx * step;
          const we = wb + step * 0.9;
          const wbm = Math.floor(wb / 60);
          const wbs = Math.floor(wb % 60);
          const wbms = Math.floor((wb % 1) * 1000);
          const wbf = `${wbm.toString().padStart(2, '0')}:${wbs.toString().padStart(2, '0')}.${wbms.toString().padStart(3, '0')}`;

          const wem = Math.floor(we / 60);
          const wes = Math.floor(we % 60);
          const wems = Math.floor((we % 1) * 1000);
          const wef = `${wem.toString().padStart(2, '0')}:${wes.toString().padStart(2, '0')}.${wems.toString().padStart(3, '0')}`;

          spans += `        <span begin="${wbf}" end="${wef}">${w} </span>\n`;
        });
      }

      pXml += `      <p begin="${beginFormatted}" end="${endFormatted}" ttm:agent="v1">\n${spans}      </p>\n`;
    }
  }

  trackForm.value.ttml_lyrics = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:title>${title}</ttm:title>
      <ttm:agent type="person" xml:id="v1">${artist}</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
${pXml}    </div>
  </body>
</tt>`;
  lyricsTab.value = 'ttml';
  systemStore.addToast('TTML Generated', 'Converted LRC to Apple Music TTML format.', 'success');
}

async function saveTrack() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const nodeId = trackForm.value.node_id;

    if (isEditing.value) {
      const res = await fetch(`/api/v1/lyrics/${nodeId}/${trackForm.value.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(trackForm.value),
      });
      if (res.ok) {
        systemStore.addToast('Lyrics Updated', '', 'success');
        showEditModal.value = false;
        await fetchLyrics();
      }
    } else {
      const res = await fetch(`/api/v1/nodes/${nodeId}/lyrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(trackForm.value),
      });
      if (res.ok) {
        systemStore.addToast('Track Created', `Saved to node "${nodeId}".`, 'success');
        showEditModal.value = false;
        await fetchLyrics();
      }
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    saving.value = false;
  }
}

async function deleteTrack(track: any) {
  if (!confirm(`Delete "${track.title}" from node ${track.node_id}?`)) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch(`/api/v1/lyrics/${track.node_id}/${track.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Track Deleted', '', 'success');
      await fetchLyrics();
    }
  } catch {}
}

function openImportModal() {
  showImportModal.value = true;
}

async function runBulkImport() {
  try {
    const token = localStorage.getItem('semar_token');
    const parsed = JSON.parse(importJson.value);
    const res = await fetch(`/api/v1/lyrics/${importTargetNode.value}/bulk-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: parsed }),
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('Bulk Import Completed', `Imported ${data.count} tracks into node ${importTargetNode.value}.`, 'success');
      showImportModal.value = false;
      await fetchLyrics();
    }
  } catch (err: any) {
    systemStore.addToast('Import Failed', err.message, 'error');
  }
}

function exportNodeLyrics() {
  const target = selectedNode.value === 'all' ? 'akai' : selectedNode.value;
  window.open(`/api/v1/lyrics/${target}/export`, '_blank');
}
</script>
