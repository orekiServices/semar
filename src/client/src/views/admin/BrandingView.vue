<template>
  <div class="max-w-4xl space-y-8">
    <div>
      <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Branding & Theme Customization</h2>
      <p class="text-xs text-slate-400 mt-1">Configure instance name, hero labels, accent colors, and custom CSS injection.</p>
    </div>

    <form @submit.prevent="saveBranding" class="space-y-6">
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Site Name</label>
            <input
              v-model="form.siteName"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tagline</label>
            <input
              v-model="form.tagline"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Hero Title</label>
          <input
            v-model="form.heroTitle"
            type="text"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Hero Subtitle</label>
          <textarea
            v-model="form.heroSubtitle"
            rows="2"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500 resize-none"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Footer Text</label>
          <input
            v-model="form.footerText"
            type="text"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div class="flex items-center justify-end gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
        >
          <Save class="w-4 h-4" />
          {{ saving ? 'Saving...' : 'Save Branding' }}
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
  siteName: '⁠♡ Semar',
  tagline: 'Self-Hosted Synchronized Lyrics Database & SemAPI Engine',
  heroTitle: 'Find & Synchronize Every Lyric',
  heroSubtitle: 'Search your self-hosted lyric nodes, community libraries, and external providers — with millisecond LRC accuracy.',
  footerText: 'Powered by Semar Engine ⁠♡ Written in TypeScript with Express & Vue 3',
});

onMounted(async () => {
  try {
    const res = await fetch('/api/settings/public');
    const data = await res.json();
    if (data.branding) {
      form.value = { ...form.value, ...data.branding };
    }
  } catch {}
});

async function saveBranding() {
  saving.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/settings/branding', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form.value),
    });
    if (res.ok) {
      systemStore.addToast('Branding Saved!', 'Updated site branding and hero text.', 'success');
      await systemStore.fetchPublicInfo();
    }
  } catch {} finally {
    saving.value = false;
  }
}
</script>
