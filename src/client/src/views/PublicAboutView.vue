<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-10">
    <div class="text-center space-y-3">
      <span class="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 uppercase tracking-wide">
        {{ aboutData?.badge || 'Semar Lyrics Engine v2.0' }}
      </span>
      <h2 class="text-3xl sm:text-5xl font-black text-white tracking-tight">
        {{ aboutData?.title || 'About Semar Engine' }}
      </h2>
      <p class="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
        {{ aboutData?.summary || 'Semar is a self-hosted synchronized lyrics platform with PostgreSQL-native multi-node isolation and JavaScript SemAPI runtime.' }}
      </p>
    </div>

    <!-- Quick Stats Cards -->
    <div v-if="aboutData?.stats" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div v-for="(val, label) in aboutData.stats" :key="label" class="glass-card p-4 rounded-2xl text-center border border-slate-800">
        <h4 class="text-xl font-black text-white capitalize">{{ val }}</h4>
        <span class="text-[11px] font-medium text-slate-400 capitalize mt-0.5 block">{{ label }}</span>
      </div>
    </div>

    <!-- Main Content Body -->
    <div class="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800 shadow-2xl space-y-6 text-slate-200 leading-relaxed text-sm whitespace-pre-line font-sans">
      {{ aboutData?.content }}
    </div>

    <!-- External Links -->
    <div v-if="aboutData?.links && aboutData.links.length > 0" class="flex flex-wrap items-center justify-center gap-4">
      <a
        v-for="link in aboutData.links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener"
        class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs border border-slate-700/80 transition flex items-center gap-2"
      >
        <ExternalLink class="w-3.5 h-3.5 text-violet-400" />
        {{ link.label }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ExternalLink } from 'lucide-vue-next';

const aboutData = ref<any>(null);

onMounted(async () => {
  try {
    const res = await fetch('/api/settings/public');
    const data = await res.json();
    if (data.about) {
      aboutData.value = data.about;
    }
  } catch {}
});
</script>
