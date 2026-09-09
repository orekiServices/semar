<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Semar Nodes Management</h2>
          <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Isolated Table Architecture
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Every node functions as an isolated lyrics service inside Semar with its own dedicated SQL table, cache namespace, and rules.
        </p>
      </div>

      <button
        @click="openCreateModal"
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2 transform hover:scale-105 active:scale-95"
      >
        <Plus class="w-4 h-4" />
        Provision New Node
      </button>
    </div>

    <!-- Node Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        v-for="node in nodes"
        :key="node.node_id"
        class="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between hover:border-violet-500/50 hover:shadow-2xl transition-all duration-300 group relative overflow-hidden"
      >
        <div class="space-y-4">
          <!-- Badges -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase">
              {{ node.node_id }}
            </span>
            <span
              v-if="node.is_special"
              class="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            >
              External · Read-only
            </span>
            <span
              v-else-if="node.is_nsfw"
              class="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30"
            >
              18+ Mature
            </span>
            <span
              v-else
              class="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            >
              Public Safe
            </span>
          </div>

          <div>
            <h3 class="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">{{ node.name }}</h3>
            <p class="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{{ node.description }}</p>
          </div>

          <!-- Specs box -->
          <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-2 text-xs font-mono">
            <div class="flex justify-between">
              <span class="text-slate-400">Total Scale:</span>
              <span class="text-white font-bold">{{ node.total_records_approx?.toLocaleString() || node.real_record_count }} tracks</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Isolated Table:</span>
              <span v-if="node.is_special" class="text-cyan-300 font-semibold">— external —</span>
              <span v-else class="text-violet-300 font-semibold">{{ node.table_name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Rate Limit:</span>
              <span class="text-emerald-400 font-semibold">{{ node.rate_limit }} rpm</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Storage Mode:</span>
              <span class="text-cyan-300 uppercase">{{ node.storage_mode }}</span>
            </div>
          </div>
        </div>

        <div class="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between gap-3">
          <router-link
            :to="`/admin/nodes/${node.node_id}`"
            class="flex-1 text-center py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center justify-center gap-1.5"
          >
            <FolderTree class="w-3.5 h-3.5" />
            {{ node.is_special ? 'View Details' : 'Manage Node Details' }}
          </router-link>

          <button
            v-if="!node.is_special"
            @click="deleteNode(node.node_id)"
            class="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
            title="Delete Node Partition"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create Node Modal -->
    <Modal v-model="showCreateModal" title="Provision New Semar Node Partition" size="xl">
      <form @submit.prevent="createNode" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Unique Node ID (lowercase slug)</label>
            <input
              v-model="nodeForm.node_id"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="e.g. kpop, vocaloid, indie"
            />
            <p class="text-[11px] text-slate-500 mt-1.5">Lowercase letters, numbers, underscores. <code class="text-cyan-400 font-mono">lrclib</code> and <code class="text-cyan-400 font-mono">lyricsovh</code> are reserved for external libraries.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Display Name</label>
            <input
              v-model="nodeForm.name"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              placeholder="e.g. K-Pop Synchronized Catalog"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
          <textarea
            v-model="nodeForm.description"
            rows="2"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
            placeholder="Describe the genre, scope, or curation focus of this node..."
          ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Approximate Scale Volume (tracks)</label>
            <input
              v-model="nodeForm.total_records_approx"
              type="number"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="100000"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Rate Limit (rpm)</label>
            <input
              v-model="nodeForm.rate_limit"
              type="number"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="120"
            />
          </div>
        </div>

        <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
          <input
            type="checkbox"
            id="nsfw_node"
            v-model="nodeForm.is_nsfw"
            class="rounded accent-rose-500 w-4 h-4"
          />
          <label for="nsfw_node" class="text-xs text-slate-300 font-semibold cursor-pointer">
            Restrict as Mature / NSFW Node (Enforces 18+ confirmation gate)
          </label>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showCreateModal = false"
            class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="creating"
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition disabled:opacity-50"
          >
            {{ creating ? 'Provisioning...' : 'Provision Node Partition' }}
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
import { Plus, FolderTree, Trash2 } from 'lucide-vue-next';

const systemStore = useSystemStore();
const nodes = ref<any[]>([]);
const showCreateModal = ref<boolean>(false);
const creating = ref<boolean>(false);

const nodeForm = ref<any>({
  node_id: '',
  name: '',
  description: '',
  total_records_approx: 50000,
  rate_limit: 120,
  is_nsfw: false,
  storage_mode: 'isolated_table',
});

onMounted(async () => {
  await fetchNodes();
});

async function fetchNodes() {
  try {
    const res = await fetch('/api/v1/nodes');
    const data = await res.json();
    if (data.nodes) {
      nodes.value = data.nodes;
    }
  } catch {}
}

function openCreateModal() {
  nodeForm.value = {
    node_id: '',
    name: '',
    description: '',
    total_records_approx: 50000,
    rate_limit: 120,
    is_nsfw: false,
    storage_mode: 'isolated_table',
  };
  showCreateModal.value = true;
}

async function createNode() {
  creating.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/v1/nodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(nodeForm.value),
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('Node Provisioned!', `Created isolated table "${data.node.table_name}".`, 'success');
      showCreateModal.value = false;
      await fetchNodes();
    } else {
      systemStore.addToast('Provision Failed', data.error || 'Failed to create node', 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    creating.value = false;
  }
}

async function deleteNode(nodeId: string) {
  if (!confirm(`Are you sure you want to drop node "${nodeId}" and its isolated table?`)) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch(`/api/v1/nodes/${nodeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Node Deleted', `Node "${nodeId}" dropped.`, 'success');
      await fetchNodes();
    }
  } catch {}
}
</script>
