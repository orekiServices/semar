<template>
  <div class="max-w-4xl space-y-8">
    <div>
      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Public About Page Configuration</h2>
      <p class="text-xs text-slate-400 mt-1">Customize the public-facing About page content, branding badge, service metadata, and links.</p>
    </div>

    <form @submit.prevent="saveAbout" class="space-y-6">
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Page Title</label>
            <input
              v-model="form.title"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Version Badge Tag</label>
            <input
              v-model="form.badge"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Short Summary / Mission</label>
          <textarea
            v-model="form.summary"
            rows="2"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Full Markdown / Text Content</label>
          <textarea
            v-model="form.content"
            rows="8"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 text-xs font-mono focus:outline-none focus:border-violet-500"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
        >
          <Save class="w-4 h-4" />
          {{ saving ? 'Saving...' : 'Save About Configuration' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import { Save } from 'lucide-vue-next';

const systemStore = useSystemStore();
const saving = ref<boolean>(false);

const form = ref<any>({
  title: 'About Semar Engine',
  badge: 'v2.0.0 PostgreSQL Edition',
  summary: '',
  content: '',
  links: [],
});

onMounted(async () => {
  try {
    const res = await fetch('/api/settings/public');
    const data = await res.json();
    if (data.about) {
      form.value = { ...data.about };
    }
  } catch {}
});

async function saveAbout() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/settings/about', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form.value),
    });
    if (res.ok) {
      systemStore.addToast('Saved!', 'Public About page configuration updated.', 'success');
      await systemStore.fetchPublicInfo();
    }
  } catch {} finally {
    saving.value = false;
  }
}
</script>
