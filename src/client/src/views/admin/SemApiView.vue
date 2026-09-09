<template>
  <div class="space-y-8">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">SemAPI Studio</h2>
          <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30">
            Node.js VM Runtime
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Create, edit, test, and manage live server-side JavaScript API endpoints directly from the web panel.
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          @click="openLogsModal"
          class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-2"
        >
          <ScrollText class="w-4 h-4 text-violet-400" />
          Execution Logs
        </button>
        <button
          @click="openCreateModal"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2 transform hover:scale-105 active:scale-95"
        >
          <Plus class="w-4 h-4" />
          New SemAPI Route
        </button>
      </div>
    </div>

    <!-- Quick Stats Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Total Routes</span>
        <h4 class="text-xl font-black text-white mt-1">{{ routes.length }}</h4>
      </div>
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Active Endpoints</span>
        <h4 class="text-xl font-black text-emerald-400 mt-1">{{ routes.filter(r => r.enabled).length }}</h4>
      </div>
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">Total Calls Executed</span>
        <h4 class="text-xl font-black text-violet-400 mt-1">{{ totalCalls.toLocaleString() }}</h4>
      </div>
      <div class="glass-card p-4 rounded-2xl border border-slate-800">
        <span class="text-[10px] uppercase font-bold text-slate-400">VM Sandbox Mode</span>
        <h4 class="text-xl font-black text-pink-400 mt-1">Real Server VM</h4>
      </div>
    </div>

    <!-- Routes List -->
    <div class="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      <div class="px-6 py-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <Zap class="w-4 h-4 text-pink-400" />
          Registered SemAPI Routes
        </h3>
        <span class="text-xs text-slate-400">Auto-dispatches under <code>/api/semapi/run/*</code></span>
      </div>

      <div v-if="loading" class="p-12 text-center text-slate-500 flex flex-col items-center">
        <RefreshCw class="w-6 h-6 animate-spin text-violet-400 mb-2" />
        <p class="text-xs">Loading registered dynamic routes...</p>
      </div>

      <div v-else-if="routes.length === 0" class="p-12 text-center text-slate-400 space-y-3">
        <Zap class="w-10 h-10 text-slate-600 mx-auto" />
        <p class="text-sm font-semibold text-white">No SemAPI routes registered yet.</p>
        <button
          @click="openCreateModal"
          class="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold"
        >
          Create First Route
        </button>
      </div>

      <div v-else class="divide-y divide-slate-800/80">
        <div
          v-for="route in routes"
          :key="route.id"
          class="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/40 transition"
        >
          <!-- Left info -->
          <div class="space-y-2 min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <!-- Method Badge -->
              <span
                class="px-2.5 py-1 rounded-lg text-xs font-mono font-black shrink-0"
                :class="getMethodClass(route.method)"
              >
                {{ route.method }}
              </span>

              <!-- Route Path -->
              <code class="text-sm font-bold text-white font-mono bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800">
                /api/semapi/run{{ route.path }}
              </code>

              <!-- Auth Badge -->
              <span
                v-if="route.auth_required"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30"
              >
                Auth Required
              </span>

              <!-- Rate limit -->
              <span class="text-[10px] font-mono text-slate-400">
                {{ route.rate_limit_rpm }} rpm
              </span>
            </div>

            <div>
              <h4 class="font-bold text-sm text-slate-200">{{ route.name }}</h4>
              <p class="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-1">{{ route.description || 'No description' }}</p>
            </div>

            <!-- Tags -->
            <div v-if="route.tags && route.tags.length > 0" class="flex flex-wrap items-center gap-1.5 pt-1">
              <span
                v-for="t in route.tags"
                :key="t"
                class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 font-mono"
              >
                #{{ t }}
              </span>
            </div>
          </div>

          <!-- Middle Stats -->
          <div class="flex items-center gap-6 text-xs font-mono shrink-0">
            <div class="text-center">
              <span class="text-slate-400 block text-[10px] uppercase">Calls</span>
              <span class="text-white font-bold">{{ route.total_calls }}</span>
            </div>
            <div class="text-center">
              <span class="text-slate-400 block text-[10px] uppercase">Errors</span>
              <span :class="route.error_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'">{{ route.error_count }}</span>
            </div>
            <div class="text-center">
              <span class="text-slate-400 block text-[10px] uppercase">Status</span>
              <span :class="route.enabled ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ route.enabled ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Right Action Buttons -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Test Runner Button -->
            <button
              @click="openTestModal(route)"
              class="px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 font-bold text-xs transition flex items-center gap-1.5"
              title="Test in Web Panel"
            >
              <Play class="w-3.5 h-3.5 fill-current" />
              Test
            </button>

            <!-- Edit Button -->
            <button
              @click="openEditModal(route)"
              class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Edit Route"
            >
              <Edit3 class="w-4 h-4" />
            </button>

            <!-- Toggle Enable -->
            <button
              @click="toggleRoute(route)"
              class="p-2 rounded-xl transition border"
              :class="route.enabled ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'"
              :title="route.enabled ? 'Disable Route' : 'Enable Route'"
            >
              <Power class="w-4 h-4" />
            </button>

            <!-- Delete Button -->
            <button
              @click="deleteRoute(route.id)"
              class="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
              title="Delete Route"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Route Create / Edit Modal -->
    <Modal v-model="showEditModal" :title="isEditing ? 'Edit SemAPI Route' : 'Create New SemAPI Route'" size="2xl">
      <form @submit.prevent="saveRoute" class="space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Route Name</label>
            <input
              v-model="routeForm.name"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              placeholder="e.g. Anime Fast Search"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">HTTP Method</label>
            <select
              v-model="routeForm.method"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 font-mono"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="ALL">ALL (Any)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Endpoint Path</label>
            <input
              v-model="routeForm.path"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="/v1/anime/search"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Rate Limit (req/min)</label>
            <input
              v-model="routeForm.rate_limit_rpm"
              type="number"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="60"
            />
          </div>
        </div>

        <!-- Auth requirement & tags -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              id="auth_req"
              v-model="routeForm.auth_required"
              class="rounded accent-violet-600 w-4 h-4"
            />
            <label for="auth_req" class="text-xs text-slate-300 font-semibold cursor-pointer">
              Require API Key Authentication
            </label>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tags (comma separated)</label>
            <input
              v-model="tagsInput"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
              placeholder="Anime, Fast, Akai"
            />
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Description / Documentation</label>
          <textarea
            v-model="routeForm.description"
            rows="2"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
            placeholder="Document what this endpoint does..."
          ></textarea>
        </div>

        <!-- Code Editor Component -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Server-Side JavaScript Execution Code</label>
          <CodeEditor v-model="routeForm.code" :filename="`handler-${routeForm.path?.replace(/\//g, '-') || 'endpoint'}.js`" />
        </div>

        <!-- Submit Buttons -->
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showEditModal = false"
            class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Route') }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Interactive Web-Panel Testing Console Modal -->
    <Modal v-model="showTestModal" :title="`Test SemAPI: ${activeTestingRoute?.name || ''}`" size="2xl">
      <div class="space-y-6">
        <!-- Endpoint Bar -->
        <div class="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
          <span
            class="px-2.5 py-1 rounded-lg text-xs font-mono font-black"
            :class="getMethodClass(activeTestingRoute?.method || 'GET')"
          >
            {{ activeTestingRoute?.method }}
          </span>
          <code class="text-sm font-mono font-bold text-white flex-1">/api/semapi/run{{ activeTestingRoute?.path }}</code>
          <button
            @click="executeTest"
            :disabled="executingTest"
            class="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play class="w-4 h-4 fill-current" />
            {{ executingTest ? 'Running...' : 'Execute Test' }}
          </button>
        </div>

        <!-- Request Config Tabs -->
        <div class="space-y-3">
          <div class="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
            <button
              @click="testTab = 'query'"
              class="px-3 py-1.5 rounded-lg font-bold transition"
              :class="testTab === 'query' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'"
            >
              Query Parameters (JSON)
            </button>
            <button
              @click="testTab = 'body'"
              class="px-3 py-1.5 rounded-lg font-bold transition"
              :class="testTab === 'body' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'"
            >
              Request Body (JSON)
            </button>
            <button
              @click="testTab = 'headers'"
              class="px-3 py-1.5 rounded-lg font-bold transition"
              :class="testTab === 'headers' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'"
            >
              Headers (JSON)
            </button>
          </div>

          <textarea
            v-if="testTab === 'query'"
            v-model="testPayload.queryStr"
            rows="4"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 font-mono text-xs focus:outline-none focus:border-violet-500"
            placeholder='{ "q": "Gurenge", "limit": 5 }'
          ></textarea>

          <textarea
            v-if="testTab === 'body'"
            v-model="testPayload.bodyStr"
            rows="4"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 font-mono text-xs focus:outline-none focus:border-violet-500"
            placeholder='{ "trackTitle": "Blinding Lights", "artistName": "The Weeknd" }'
          ></textarea>

          <textarea
            v-if="testTab === 'headers'"
            v-model="testPayload.headersStr"
            rows="4"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 font-mono text-xs focus:outline-none focus:border-violet-500"
            placeholder='{ "X-SemAPI-Key": "semar_master_key..." }'
          ></textarea>
        </div>

        <!-- Real-Time Test Execution Result -->
        <div v-if="testResult" class="space-y-4 pt-4 border-t border-slate-800">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <Terminal class="w-4 h-4 text-emerald-400" />
              Live Server Response & Output
            </h4>

            <div class="flex items-center gap-3 text-xs font-mono">
              <span
                class="px-2.5 py-0.5 rounded-full font-bold"
                :class="testResult.statusCode < 400 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'"
              >
                HTTP {{ testResult.statusCode }}
              </span>
              <span class="text-slate-400">{{ testResult.latencyMs }}ms</span>
            </div>
          </div>

          <!-- Server Log Messages (ctx.log) -->
          <div v-if="testResult.logs && testResult.logs.length > 0" class="bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-xs space-y-1">
            <span class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Server ctx.log() Messages:</span>
            <div v-for="(l, i) in testResult.logs" :key="i" class="text-cyan-300">> {{ l }}</div>
          </div>

          <!-- Response Body Preview -->
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-violet-200 overflow-x-auto max-h-64 whitespace-pre">
            {{ formatJson(testResult.body) }}
          </div>
        </div>
      </div>
    </Modal>

    <!-- SemAPI Execution Logs Modal -->
    <Modal v-model="showLogsModal" title="SemAPI Real-Time Execution Logs" size="4xl">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400">Showing recent server-side SemAPI route calls and execution logs</span>
          <button
            @click="fetchLogs"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="loadingLogs ? 'animate-spin' : ''" />
            Refresh Logs
          </button>
        </div>

        <div class="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-slate-900 border-b border-slate-800 text-slate-400">
              <tr>
                <th class="p-3">Time</th>
                <th class="p-3">Route ID</th>
                <th class="p-3">Method</th>
                <th class="p-3">Status</th>
                <th class="p-3">Latency</th>
                <th class="p-3">IP</th>
                <th class="p-3">Preview</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-900 text-slate-300">
              <tr v-for="log in executionLogs" :key="log.id" class="hover:bg-slate-900/50">
                <td class="p-3 text-slate-400">{{ formatTimestamp(log.created_at) }}</td>
                <td class="p-3 text-violet-300 font-bold">{{ log.route_id }}</td>
                <td class="p-3">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" :class="getMethodClass(log.method)">{{ log.method }}</span>
                </td>
                <td class="p-3 font-bold" :class="log.status_code < 400 ? 'text-emerald-400' : 'text-rose-400'">{{ log.status_code }}</td>
                <td class="p-3">{{ log.latency_ms }}ms</td>
                <td class="p-3 text-slate-400">{{ log.ip }}</td>
                <td class="p-3 truncate max-w-xs text-slate-400">{{ log.response_preview }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import CodeEditor from '../../components/CodeEditor.vue';
import {
  Zap,
  Plus,
  ScrollText,
  Play,
  Edit3,
  Trash2,
  Power,
  RefreshCw,
  Terminal,
} from 'lucide-vue-next';

const systemStore = useSystemStore();
const routes = ref<any[]>([]);
const loading = ref<boolean>(true);

// Edit/Create Modal State
const showEditModal = ref<boolean>(false);
const isEditing = ref<boolean>(false);
const saving = ref<boolean>(false);
const tagsInput = ref<string>('');

const routeForm = ref<any>({
  id: '',
  name: '',
  path: '',
  method: 'GET',
  rate_limit_rpm: 60,
  auth_required: false,
  description: '',
  code: '',
  tags: [],
});

// Test Modal State
const showTestModal = ref<boolean>(false);
const activeTestingRoute = ref<any>(null);
const executingTest = ref<boolean>(false);
const testTab = ref<'query' | 'body' | 'headers'>('query');
const testPayload = ref({
  queryStr: '{\n  "q": "Gurenge"\n}',
  bodyStr: '{\n  "trackTitle": "Blinding Lights"\n}',
  headersStr: '{}',
});
const testResult = ref<any>(null);

// Logs Modal State
const showLogsModal = ref<boolean>(false);
const executionLogs = ref<any[]>([]);
const loadingLogs = ref<boolean>(false);

const totalCalls = computed(() => {
  return routes.value.reduce((acc, r) => acc + (r.total_calls || 0), 0);
});

onMounted(async () => {
  await fetchRoutes();
});

async function fetchRoutes() {
  loading.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/semapi/routes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.routes) {
      routes.value = data.routes;
    }
  } catch {} finally {
    loading.value = false;
  }
}

function openCreateModal() {
  isEditing.value = false;
  routeForm.value = {
    id: 'route-' + Math.random().toString(36).substring(2, 8),
    name: '',
    path: '/v1/custom/endpoint',
    method: 'GET',
    rate_limit_rpm: 60,
    auth_required: false,
    description: '',
    code: `// SemAPI Dynamic JavaScript Handler\nasync function handler(ctx) {\n  ctx.log("Executing handler for: " + ctx.path);\n  \n  return ctx.json({\n    status: "ok",\n    timestamp: new Date().toISOString(),\n    message: "Hello from SemAPI!"\n  });\n}`,
    tags: ['Custom'],
  };
  tagsInput.value = 'Custom';
  showEditModal.value = true;
}

function openEditModal(route: any) {
  isEditing.value = true;
  routeForm.value = { ...route };
  tagsInput.value = (route.tags || []).join(', ');
  showEditModal.value = true;
}

async function saveRoute() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const tags = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);
    routeForm.value.tags = tags;

    const url = isEditing.value ? `/api/semapi/routes/${routeForm.value.id}` : '/api/semapi/routes';
    const method = isEditing.value ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(routeForm.value),
    });

    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('SemAPI Route Saved', `Route "${routeForm.value.name}" successfully compiled and registered.`, 'success');
      showEditModal.value = false;
      await fetchRoutes();
    } else {
      systemStore.addToast('Save Failed', data.error || 'Failed to save SemAPI route', 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleRoute(route: any) {
  try {
    const token = localStorage.getItem('semar_token');
    const newStatus = !route.enabled;
    const res = await fetch(`/api/semapi/routes/${route.id}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled: newStatus }),
    });
    if (res.ok) {
      route.enabled = newStatus;
      systemStore.addToast('Route Toggled', `Route is now ${newStatus ? 'ENABLED' : 'DISABLED'}.`, 'info');
    }
  } catch {}
}

async function deleteRoute(id: string) {
  if (!confirm('Are you sure you want to delete this SemAPI route?')) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch(`/api/semapi/routes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Route Deleted', 'SemAPI route removed.', 'success');
      await fetchRoutes();
    }
  } catch {}
}

function openTestModal(route: any) {
  activeTestingRoute.value = route;
  testResult.value = null;
  showTestModal.value = true;
}

async function executeTest() {
  if (!activeTestingRoute.value) return;
  executingTest.value = true;
  testResult.value = null;

  try {
    const token = localStorage.getItem('semar_token');
    let queryObj = {};
    let bodyObj = {};
    let headersObj = {};

    try { queryObj = JSON.parse(testPayload.value.queryStr || '{}'); } catch {}
    try { bodyObj = JSON.parse(testPayload.value.bodyStr || '{}'); } catch {}
    try { headersObj = JSON.parse(testPayload.value.headersStr || '{}'); } catch {}

    const res = await fetch(`/api/semapi/test/${activeTestingRoute.value.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        method: activeTestingRoute.value.method === 'ALL' ? 'GET' : activeTestingRoute.value.method,
        query: queryObj,
        body: bodyObj,
        headers: headersObj,
      }),
    });

    const data = await res.json();
    if (data.execution) {
      testResult.value = data.execution;
      systemStore.addToast('Test Completed', `Status: ${data.execution.statusCode} (${data.execution.latencyMs}ms)`, data.execution.statusCode < 400 ? 'success' : 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Execution Error', err.message, 'error');
  } finally {
    executingTest.value = false;
  }
}

function openLogsModal() {
  showLogsModal.value = true;
  fetchLogs();
}

async function fetchLogs() {
  loadingLogs.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/semapi/logs?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.logs) {
      executionLogs.value = data.logs;
    }
  } catch {} finally {
    loadingLogs.value = false;
  }
}

function formatJson(data: any): string {
  try {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function formatTimestamp(ts: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString();
}

function getMethodClass(method: string) {
  switch ((method || '').toUpperCase()) {
    case 'GET': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'POST': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'PUT': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    case 'PATCH': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
    case 'DELETE': return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    default: return 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
  }
}
</script>
