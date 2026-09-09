<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8">
    <div v-if="loading" class="py-24 text-center text-slate-500">
      <RefreshCw class="w-8 h-8 animate-spin text-violet-400 mx-auto mb-2" />
      <p class="text-sm">Loading custom page...</p>
    </div>

    <div v-else-if="!page" class="py-24 text-center glass-card rounded-3xl p-8 max-w-md mx-auto space-y-3">
      <h3 class="text-xl font-bold text-white">Page Not Found</h3>
      <p class="text-xs text-slate-400">The custom page "/p/{{ $route.params.slug }}" does not exist or is not published.</p>
      <router-link to="/" class="inline-flex px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold">
        Return Home
      </router-link>
    </div>

    <div v-else class="space-y-6">
      <div class="border-b border-slate-800 pb-4">
        <h2 class="text-3xl font-black text-white tracking-tight">{{ page.title }}</h2>
        <span class="text-xs text-slate-400 mt-1 block">Custom Page • /p/{{ page.slug }}</span>
      </div>

      <div class="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800 shadow-2xl leading-relaxed text-sm text-slate-200 whitespace-pre-line font-sans">
        {{ page.content }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { RefreshCw } from 'lucide-vue-next';

const route = useRoute();
const page = ref<any>(null);
const loading = ref<boolean>(true);

onMounted(loadPage);
watch(() => route.params.slug, loadPage);

async function loadPage() {
  const slug = route.params.slug as string;
  if (!slug) return;
  loading.value = true;
  try {
    const res = await fetch(`/api/pages/${slug}`);
    const data = await res.json();
    if (data.page) {
      page.value = data.page;
    } else {
      page.value = null;
    }
  } catch {
    page.value = null;
  } finally {
    loading.value = false;
  }
}
</script>
