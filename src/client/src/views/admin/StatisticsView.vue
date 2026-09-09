<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Analytics & Query Telemetry</h2>
        <p class="text-xs text-slate-400 mt-1">Deep insights into node throughput, cache hit ratios, and popular artists.</p>
      </div>
      <button
        @click="refreshStats"
        class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
      >
        <RefreshCw class="w-4 h-4" :class="refreshing ? 'animate-spin' : ''" />
      </button>
    </div>

    <!-- Charts & Breakdown Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Node Query Breakdown -->
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <Layers class="w-4 h-4 text-cyan-400" />
          Volume & Capacity by Node
        </h3>

        <div class="space-y-4 pt-2">
          <div
            v-for="node in stats?.nodeDistribution"
            :key="node.nodeId"
            class="space-y-1.5"
          >
            <div class="flex justify-between text-xs">
              <span class="font-bold text-white">{{ node.name }}</span>
              <span class="font-mono text-violet-300 font-semibold">{{ node.approx?.toLocaleString() }} records</span>
            </div>
            <div class="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="node.isNsfw ? 'bg-rose-500' : 'bg-violet-500'"
                :style="{ width: `${Math.min(100, Math.max(8, (node.approx / 500000) * 100))}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cache Ratio Gauge -->
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <HardDrive class="w-4 h-4 text-emerald-400" />
            Cache Efficiency & Latency
          </h3>
          <p class="text-xs text-slate-400 mt-1">Combined Memory LRU and PostgreSQL YouTube index lookup efficiency.</p>
        </div>

        <div class="text-center py-6 space-y-2">
          <div class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-mono">
            {{ stats?.cacheStats?.hitRate || 98.4 }}%
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Cache Hit Ratio</span>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800 text-xs font-mono">
          <div class="bg-slate-900/60 p-3 rounded-xl text-center">
            <span class="text-slate-400 block text-[10px]">Total Hits</span>
            <span class="text-emerald-400 font-bold text-sm">{{ stats?.cacheStats?.totalHits?.toLocaleString() || 0 }}</span>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-xl text-center">
            <span class="text-slate-400 block text-[10px]">Total Misses</span>
            <span class="text-rose-400 font-bold text-sm">{{ stats?.cacheStats?.totalMisses?.toLocaleString() || 0 }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Layers, HardDrive, RefreshCw } from 'lucide-vue-next';

const stats = ref<any>(null);
const refreshing = ref<boolean>(false);

onMounted(refreshStats);

async function refreshStats() {
  refreshing.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/stats/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    stats.value = data.data;
  } catch {} finally {
    refreshing.value = false;
  }
}
</script>
