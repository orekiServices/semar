<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Database Console & Schemas</h2>
          <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {{ dbInfo?.type?.toUpperCase() || 'POSTGRESQL' }}
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Postgres-only multi-node partition inspection (PostgreSQL, PGlite embedded, or MySQL).</p>
      </div>

      <button
        @click="openSwitchModal"
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
      >
        <Database class="w-4 h-4" />
        Switch Database Engine
      </button>
    </div>

    <!-- Active Tables Grid -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <Table class="w-4 h-4 text-violet-400" />
          Active Database Tables ({{ dbInfo?.tables?.length || 0 }})
        </h3>
        <span class="text-xs font-mono text-emerald-400 font-semibold">● Connection Latency: {{ dbInfo?.connection?.latencyMs || 1 }}ms</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          v-for="tbl in dbInfo?.tables"
          :key="tbl.name"
          class="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1"
        >
          <code class="text-xs font-mono font-bold text-violet-300 block truncate">{{ tbl.name }}</code>
          <span class="text-xs text-slate-400 font-mono">{{ tbl.rowCount?.toLocaleString() }} rows</span>
        </div>
      </div>
    </div>

    <!-- Safe SQL Query Runner -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <Terminal class="w-4 h-4 text-emerald-400" />
          SQL Query Runner (Admin Protected)
        </h3>
        <button
          @click="runQuery"
          :disabled="runningQuery"
          class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <Play class="w-3.5 h-3.5 fill-current" />
          {{ runningQuery ? 'Executing...' : 'Run Query' }}
        </button>
      </div>

      <textarea
        v-model="sqlQuery"
        rows="3"
        class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 font-mono text-xs focus:outline-none focus:border-violet-500"
        placeholder="SELECT * FROM nodes;"
      ></textarea>

      <!-- Query Output -->
      <div v-if="queryResult" class="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto max-h-72">
        <span class="text-slate-400 block mb-2 font-bold">{{ queryResult.count }} rows returned:</span>
        <pre class="text-violet-200">{{ JSON.stringify(queryResult.rows, null, 2) }}</pre>
      </div>
    </div>

    <!-- Switch Engine Modal -->
    <Modal v-model="showSwitchModal" title="Switch Production Database Engine" size="lg">
      <form @submit.prevent="switchEngine" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Engine Type</label>
          <select
            v-model="switchForm.type"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
          >
            <option value="postgres">PostgreSQL (Production standard)</option>
            <option value="mysql">MySQL / MariaDB</option>
            <option value="pglite">PGlite (Embedded Postgres)</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Connection URL / Path</label>
          <input
            v-model="switchForm.connectionString"
            type="text"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
            :placeholder="switchForm.type === 'postgres' ? 'postgres://user:pass@host:5432/semar' : switchForm.type === 'mysql' ? 'mysql://user:pass@host:3306/semar' : '(optional) /path/to/pglite-data — blank = in-memory'"
          />
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showSwitchModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="switching"
            class="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs"
          >
            {{ switching ? 'Connecting & Migrating...' : 'Connect & Switch' }}
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
import { Database, Table, Terminal, Play } from 'lucide-vue-next';

const systemStore = useSystemStore();
const dbInfo = ref<any>(null);

const sqlQuery = ref<string>('SELECT * FROM nodes;');
const queryResult = ref<any>(null);
const runningQuery = ref<boolean>(false);

const showSwitchModal = ref<boolean>(false);
const switching = ref<boolean>(false);
const switchForm = ref<any>({
  type: 'postgres',
  connectionString: '',
});

onMounted(fetchDbInfo);

async function fetchDbInfo() {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/database/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    dbInfo.value = data;
  } catch {}
}

async function runQuery() {
  if (!sqlQuery.value) return;
  runningQuery.value = true;
  queryResult.value = null;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/database/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sql: sqlQuery.value }),
    });
    const data = await res.json();
    if (res.ok) {
      queryResult.value = data;
    } else {
      systemStore.addToast('Query Error', data.message || data.error, 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    runningQuery.value = false;
  }
}

function openSwitchModal() {
  switchForm.value.type = dbInfo.value?.type || 'postgres';
  switchForm.value.connectionString = '';
  showSwitchModal.value = true;
}

async function switchEngine() {
  switching.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/database/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(switchForm.value),
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('Switched Engine', `Switched to ${switchForm.value.type}`, 'success');
      showSwitchModal.value = false;
      await fetchDbInfo();
    } else {
      systemStore.addToast('Switch Failed', data.error, 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    switching.value = false;
  }
}
</script>
