<template>
  <div class="max-w-4xl space-y-8">
    <div>
      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Admin & Installation Setup</h2>
      <p class="text-xs text-slate-400 mt-1">Manage system superadmin credentials, database backends, and initial bootstrap flags.</p>
    </div>

    <!-- Admin Account Card -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-6">
      <div class="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div class="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
          <ShieldCheck class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white">Superadmin Security</h3>
          <p class="text-xs text-slate-400">Update master superadmin password and session parameters</p>
        </div>
      </div>

      <form @submit.prevent="updatePassword" class="space-y-4 max-w-lg">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Current Password</label>
          <input
            v-model="currentPassword"
            type="password"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
          <input
            v-model="newPassword"
            type="password"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
          />
        </div>

        <button
          type="submit"
          :disabled="savingPassword"
          class="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center gap-2"
        >
          <Save class="w-4 h-4" />
          {{ savingPassword ? 'Updating...' : 'Update Password' }}
        </button>
      </form>
    </div>

    <!-- Database Reconfiguration Quick Panel -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Database Migration & Engine</h3>
            <p class="text-xs text-slate-400">View database console or switch dialect to PostgreSQL / MySQL</p>
          </div>
        </div>

        <router-link
          to="/admin/database"
          class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center gap-1.5 border border-slate-700"
        >
          Open Database Console →
        </router-link>
      </div>

      <div class="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
        <span class="text-slate-300 font-semibold">Active Backend: <code class="text-violet-300 font-mono">{{ activeDbType.toUpperCase() }}</code></span>
        <span class="text-emerald-400 flex items-center gap-1.5 font-bold">
          <CheckCircle2 class="w-4 h-4" />
          Schema Migrations Up to Date
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import { ShieldCheck, Save, Database, CheckCircle2 } from 'lucide-vue-next';

const systemStore = useSystemStore();

const currentPassword = ref<string>('');
const newPassword = ref<string>('');
const savingPassword = ref<boolean>(false);
const activeDbType = ref<string>('postgres');

onMounted(async () => {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/database/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.type) {
      activeDbType.value = data.type;
    }
  } catch {}
});

async function updatePassword() {
  savingPassword.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('Password Updated', 'Superadmin password was updated successfully.', 'success');
      currentPassword.value = '';
      newPassword.value = '';
    } else {
      systemStore.addToast('Failed', data.error || 'Password update failed', 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    savingPassword.value = false;
  }
}
</script>
