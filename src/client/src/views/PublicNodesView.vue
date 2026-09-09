<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-10">
    <div class="text-center max-w-3xl mx-auto space-y-3">
      <span class="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 uppercase tracking-wide">
        Multi-Node Isolated Architecture
      </span>
      <h2 class="text-3xl sm:text-4xl font-black text-white tracking-tight">Semar Nodes Directory</h2>
      <p class="text-sm text-slate-300 leading-relaxed">
        Semar segregates lyric catalogs into independent, isolated database namespaces. Every node maintains its own table partition, cache layer, and curation guidelines.
      </p>
    </div>

    <div v-if="nodes.length === 0" class="py-16 text-center glass-card rounded-2xl p-8 space-y-3">
      <h4 class="font-bold text-white">No nodes yet</h4>
      <p class="text-xs text-slate-400 max-w-sm mx-auto">This instance has no lyric nodes. An admin can provision one from the control panel.</p>
    </div>

    <!-- Node Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        v-for="node in nodes"
        :key="node.node_id"
        class="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between hover:border-violet-500/50 hover:shadow-2xl transition-all duration-300 group relative overflow-hidden"
      >
        <div class="space-y-4">
          <!-- Top Badges -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase">
              {{ node.node_id }}
            </span>
            <span
              v-if="node.is_special"
              class="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            >
              External Library
            </span>
            <span
              v-else-if="node.is_nsfw"
              class="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30"
            >
              18+ Mature
            </span>
            <span
              v-else
              class="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            >
              Public Safe
            </span>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white group-hover:text-violet-300 transition-colors">{{ node.name }}</h3>
            <p class="text-xs text-slate-400 mt-2 leading-relaxed">{{ node.description }}</p>
          </div>

          <!-- Stats / Specs -->
          <div class="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 text-xs font-mono">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Scale / Volume:</span>
              <span class="text-white font-bold">{{ node.total_records_approx?.toLocaleString() || node.real_record_count }} tracks</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Storage:</span>
              <span v-if="node.is_special" class="text-cyan-300 font-semibold">live · read-only</span>
              <span v-else class="text-violet-300 font-semibold">{{ node.table_name }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Rate Limit:</span>
              <span class="text-emerald-400 font-semibold">{{ node.rate_limit }} rpm</span>
            </div>
          </div>
        </div>

        <div class="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between gap-3">
          <router-link
            :to="`/nodes/${node.node_id}`"
            class="flex-1 text-center py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 transition flex items-center justify-center gap-1.5"
          >
            <FolderTree class="w-3.5 h-3.5" />
            {{ node.is_special ? 'Search Library' : 'Explore Catalog' }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { FolderTree } from 'lucide-vue-next';

const nodes = ref<any[]>([]);

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/nodes');
    const data = await res.json();
    if (data.nodes) {
      nodes.value = data.nodes;
    }
  } catch {}
});
</script>
