<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Server & Security Audit Logs</h2>
        <p class="text-xs text-slate-400 mt-1">Real-time audit trail of administrative actions, authentication events, and partition changes.</p>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          @click="fetchLogs"
          class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-2"
        >
          <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
          Refresh
        </button>
        <button
          @click="clearLogs"
          class="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold transition flex items-center gap-2"
        >
          <Trash2 class="w-4 h-4" />
          Clear Logs
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="border border-slate-800 rounded-3xl overflow-hidden bg-slate-950 shadow-2xl">
      <div v-if="loading" class="p-12 text-center text-slate-500">
        <RefreshCw class="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
        <p class="text-xs">Loading audit events...</p>
      </div>

      <div v-else-if="logs.length === 0" class="p-12 text-center text-slate-400">
        <p class="text-sm font-semibold text-white">No audit logs recorded yet.</p>
      </div>

      <table v-else class="w-full text-left text-xs font-mono">
        <thead class="bg-slate-900 border-b border-slate-800 text-slate-400">
          <tr>
            <th class="p-3.5">Timestamp</th>
            <th class="p-3.5">Event Type</th>
            <th class="p-3.5">Actor</th>
            <th class="p-3.5">IP Address</th>
            <th class="p-3.5">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900 text-slate-300">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-slate-900/40">
            <td class="p-3.5 text-slate-400">{{ formatTimestamp(log.created_at) }}</td>
            <td class="p-3.5 font-bold text-violet-300">
              <span class="px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">
                {{ log.event_type }}
              </span>
            </td>
            <td class="p-3.5 text-white font-bold">{{ log.actor }}</td>
            <td class="p-3.5 text-slate-400">{{ log.ip }}</td>
            <td class="p-3.5 text-slate-300 truncate max-w-sm">{{ JSON.stringify(log.details) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import { RefreshCw, Trash2 } from 'lucide-vue-next';

const systemStore = useSystemStore();
const logs = ref<any[]>([]);
const loading = ref<boolean>(true);

onMounted(fetchLogs);

async function fetchLogs() {
  loading.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/logs/audit?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    logs.value = data.logs || [];
  } catch {} finally {
    loading.value = false;
  }
}

async function clearLogs() {
  if (!confirm('Clear all audit logs?')) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/logs/audit', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Logs Cleared', '', 'info');
      await fetchLogs();
    }
  } catch {}
}

function formatTimestamp(ts: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}
</script>
