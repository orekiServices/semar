<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Security & API Keys</h2>
        <p class="text-xs text-slate-400 mt-1">Manage bearer tokens, dynamic SemAPI authentication keys, and access permissions.</p>
      </div>

      <button
        @click="openCreateKeyModal"
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        Generate New API Key
      </button>
    </div>

    <!-- API Keys Table -->
    <div class="border border-slate-800 rounded-3xl overflow-hidden bg-slate-950 shadow-2xl">
      <div class="p-6 border-b border-slate-800 flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <Key class="w-4 h-4 text-violet-400" />
          Active API Keys ({{ apiKeys.length }})
        </h3>
      </div>

      <table class="w-full text-left text-xs">
        <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
          <tr>
            <th class="p-3.5">Name</th>
            <th class="p-3.5">Key Prefix</th>
            <th class="p-3.5">Permissions</th>
            <th class="p-3.5">Rate Limit</th>
            <th class="p-3.5">Requests</th>
            <th class="p-3.5">Status</th>
            <th class="p-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900 text-slate-300">
          <tr v-for="k in apiKeys" :key="k.id" class="hover:bg-slate-900/40">
            <td class="p-3.5 font-bold text-white">{{ k.name }}</td>
            <td class="p-3.5 font-mono text-violet-300">{{ k.key_prefix }}</td>
            <td class="p-3.5">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="p in k.permissions"
                  :key="p"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700"
                >
                  {{ p }}
                </span>
              </div>
            </td>
            <td class="p-3.5 font-mono">{{ k.rate_limit_rpm }} rpm</td>
            <td class="p-3.5 font-mono text-emerald-400 font-bold">{{ k.total_requests }}</td>
            <td class="p-3.5">
              <span :class="k.is_active ? 'text-emerald-400 font-bold' : 'text-slate-500'">
                {{ k.is_active ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td class="p-3.5 text-right">
              <button
                @click="deleteKey(k.id)"
                class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Revoke Key"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create API Key Modal -->
    <Modal v-model="showCreateModal" title="Generate New API Key" size="lg">
      <form @submit.prevent="generateKey" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Key Name / Identifier</label>
          <input
            v-model="keyForm.name"
            type="text"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            placeholder="e.g. Spotify Bot Client"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Rate Limit (rpm)</label>
          <input
            v-model="keyForm.rate_limit_rpm"
            type="number"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
            placeholder="120"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Permissions</label>
          <div class="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
              <input type="checkbox" value="read" v-model="keyForm.permissions" class="rounded accent-violet-600" />
              <span>read (Search lyrics)</span>
            </label>
            <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
              <input type="checkbox" value="write" v-model="keyForm.permissions" class="rounded accent-violet-600" />
              <span>write (Create lyrics)</span>
            </label>
            <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
              <input type="checkbox" value="semapi:execute" v-model="keyForm.permissions" class="rounded accent-violet-600" />
              <span>semapi:execute (Run routes)</span>
            </label>
            <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
              <input type="checkbox" value="curator:write" v-model="keyForm.permissions" class="rounded accent-violet-600" />
              <span>curator:write (Ingest webhook)</span>
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showCreateModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs"
          >
            Generate Key
          </button>
        </div>
      </form>
    </Modal>

    <!-- Raw Key Display Modal -->
    <Modal v-model="showRawKeyModal" title="API Key Generated Successfully" size="md">
      <div class="space-y-4 text-center py-2">
        <p class="text-xs text-amber-400 font-semibold">Copy this API key now. It will not be shown again.</p>
        <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 select-all break-all">
          {{ rawKeyGenerated }}
        </div>
        <button
          @click="copyKeyAndClose"
          class="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-xs"
        >
          Copy Key & Close
        </button>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import { Plus, Key, Trash2 } from 'lucide-vue-next';

const systemStore = useSystemStore();
const apiKeys = ref<any[]>([]);
const showCreateModal = ref<boolean>(false);
const showRawKeyModal = ref<boolean>(false);
const rawKeyGenerated = ref<string>('');

const keyForm = ref<any>({
  name: '',
  rate_limit_rpm: 120,
  permissions: ['read', 'semapi:execute'],
});

onMounted(fetchKeys);

async function fetchKeys() {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/security/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    apiKeys.value = data.keys || [];
  } catch {}
}

function openCreateKeyModal() {
  keyForm.value = {
    name: '',
    rate_limit_rpm: 120,
    permissions: ['read', 'semapi:execute'],
  };
  showCreateModal.value = true;
}

async function generateKey() {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/security/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(keyForm.value),
    });
    const data = await res.json();
    if (res.ok) {
      rawKeyGenerated.value = data.rawKey;
      showCreateModal.value = false;
      showRawKeyModal.value = true;
      await fetchKeys();
    }
  } catch {}
}

function copyKeyAndClose() {
  navigator.clipboard.writeText(rawKeyGenerated.value);
  systemStore.addToast('Copied API Key to clipboard', '', 'success');
  showRawKeyModal.value = false;
}

async function deleteKey(id: string) {
  if (!confirm('Revoke this API Key?')) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch(`/api/admin/security/api-keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Key Revoked', '', 'info');
      await fetchKeys();
    }
  } catch {}
}
</script>
