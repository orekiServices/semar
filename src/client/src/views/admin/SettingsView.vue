<template>
  <div class="max-w-4xl space-y-8">
    <div>
      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">System Settings & Deployment</h2>
      <p class="text-xs text-slate-400 mt-1">Global server configurations, memory cache parameters, and Vercel environment flags.</p>
    </div>

    <!-- Environment Information Box -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-3">
      <h3 class="text-base font-bold text-white flex items-center gap-2">
        <Sliders class="w-4 h-4 text-violet-400" />
        Runtime & Deployment Status
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-2">
        <div class="bg-slate-900/60 p-3 rounded-xl">
          <span class="text-slate-400 block text-[10px]">Node.js</span>
          <span class="text-white font-bold">{{ envInfo?.nodeVersion || 'v22.x' }}</span>
        </div>
        <div class="bg-slate-900/60 p-3 rounded-xl">
          <span class="text-slate-400 block text-[10px]">Target</span>
          <span class="text-emerald-400 font-bold">{{ envInfo?.isVercel ? 'Vercel Serverless' : 'Self-Hosted' }}</span>
        </div>
        <div class="bg-slate-900/60 p-3 rounded-xl">
          <span class="text-slate-400 block text-[10px]">Database Engine</span>
          <span class="text-violet-300 font-bold uppercase">{{ dbType }}</span>
        </div>
        <div class="bg-slate-900/60 p-3 rounded-xl">
          <span class="text-slate-400 block text-[10px]">Server Uptime</span>
          <span class="text-slate-300 font-bold">{{ formatUptime(envInfo?.uptimeSeconds) }}</span>
        </div>
      </div>
    </div>

    <!-- Settings Form -->
    <form @submit.prevent="saveSettings" class="space-y-6">
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Default Query Node</label>
            <select
              v-model="form.defaultNode"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
            >
              <option value="akai">Akai (Eastern & Anime)</option>
              <option value="pine">PiNE (Global Hits)</option>
              <option value="pakai">PAKAI (Mature)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Cache TTL (Seconds)</label>
            <input
              v-model="form.cacheTtlSeconds"
              type="number"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Memory Cache Max Items</label>
            <input
              v-model="form.memoryCacheCapacity"
              type="number"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
            />
          </div>

          <div class="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mt-5">
            <input
              type="checkbox"
              id="maint_mode"
              v-model="form.maintenanceMode"
              class="rounded accent-violet-600 w-4 h-4"
            />
            <label for="maint_mode" class="text-xs text-slate-300 font-semibold cursor-pointer">
              Enable Maintenance Mode
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
        >
          <Save class="w-4 h-4" />
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import { Sliders, Save } from 'lucide-vue-next';

const systemStore = useSystemStore();
const saving = ref<boolean>(false);
const dbType = ref<string>('postgres');
const envInfo = ref<any>(null);

const form = ref<any>({
  defaultNode: 'akai',
  cacheTtlSeconds: 86400,
  memoryCacheCapacity: 5000,
  maintenanceMode: false,
});

onMounted(async () => {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.settings?.system_settings) {
      form.value = { ...data.settings.system_settings };
    }
    dbType.value = data.databaseType || 'postgres';
    envInfo.value = data.environment;
  } catch {}
});

async function saveSettings() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ system_settings: form.value }),
    });
    if (res.ok) {
      systemStore.addToast('Saved', 'System settings updated.', 'success');
    }
  } catch {} finally {
    saving.value = false;
  }
}

function formatUptime(secs: number): string {
  if (!secs) return 'Active';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s}s`;
}
</script>
