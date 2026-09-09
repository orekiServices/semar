<template>
  <div class="space-y-8">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">System Dashboard</h2>
        <p class="text-xs text-slate-400 mt-1">Real-time overview of isolated nodes, SemAPI execution, cache metrics, and database health.</p>
      </div>

      <div class="flex items-center gap-3">
        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          Engine Active: {{ dashboardData?.overview?.databaseType?.toUpperCase() || 'POSTGRES' }}
        </span>
        <button
          @click="refreshDashboard"
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          title="Refresh Metrics"
        >
          <RefreshCw class="w-4 h-4" :class="refreshing ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <!-- Metric Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <MetricCard
        title="Total Indexed Scale"
        :value="dashboardData?.overview?.totalApproxLyrics?.toLocaleString() || '0'"
        unit="tracks"
        subtext="Multi-node isolated capacity"
        :icon="Music"
        color="violet"
      />

      <MetricCard
        title="Active SemAPI Routes"
        :value="dashboardData?.overview?.activeSemApiRoutes ?? '0'"
        unit="active"
        :subtext="`${dashboardData?.overview?.totalSemApiCalls || 0} total calls executed`"
        :icon="Zap"
        color="pink"
      />

      <MetricCard
        title="YouTube Video ID Cache"
        :value="dashboardData?.overview?.youtubeCachedCount || '0'"
        unit="keys"
        subtext="Direct video ID mappings"
        :icon="Youtube"
        color="rose"
      />

      <MetricCard
        title="Cache Hit Ratio"
        :value="`${dashboardData?.overview?.cacheHitRate || 98.4}%`"
        unit="hit rate"
        subtext="Memory LRU + Table cache"
        :icon="HardDrive"
        color="emerald"
      />
    </div>

    <!-- MIN-AI Engine Status (v2.2) -->
    <div class="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-300 flex items-center justify-center shrink-0">
          <BrainCircuit class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            MIN-AI Lyrics Engine
            <span
              v-if="dashboardData?.overview?.minai?.trained"
              class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase"
            >
              Trained
            </span>
            <span
              v-else
              class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase"
            >
              Untrained
            </span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            <template v-if="dashboardData?.overview?.minai?.trained">
              Markov model: {{ dashboardData.overview.minai.tracks }} tracks · {{ dashboardData.overview.minai.states }} states · powers AI Generate, Finder & Similar
            </template>
            <template v-else>
              Train on your catalog to enable AI Generate, Finder & Similar tracks
            </template>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <router-link
          to="/ai"
          class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
        >
          <Sparkles class="w-3.5 h-3.5" />
          Open AI Studio
        </router-link>
        <button
          @click="trainMinai"
          :disabled="trainingMinai"
          class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="trainingMinai ? 'animate-spin' : ''" />
          {{ trainingMinai ? 'Training...' : dashboardData?.overview?.minai?.trained ? 'Retrain' : 'Train Now' }}
        </button>
      </div>
    </div>

    <!-- Middle Section: Node Partitions & Request Volume Chart -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Node Partitions Distribution -->
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <Layers class="w-4 h-4 text-cyan-400" />
              Node Storage Partitions
            </h3>
            <router-link to="/admin/nodes" class="text-xs text-violet-400 hover:text-violet-300 font-semibold">
              Manage →
            </router-link>
          </div>

          <div class="space-y-3">
            <div
              v-for="node in dashboardData?.nodeDistribution"
              :key="node.nodeId"
              class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-white">{{ node.name }}</span>
                <span class="font-mono text-slate-400">{{ node.approx?.toLocaleString() }} tracks</span>
              </div>
              <!-- Progress bar -->
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="node.isNsfw ? 'bg-rose-500' : 'bg-violet-500'"
                  :style="{ width: `${Math.min(100, Math.max(10, (node.approx / 500000) * 100))}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span>Active Nodes: {{ dashboardData?.overview?.activeNodes ?? 0 }} ({{ dashboardData?.overview?.specialNodes ?? 0 }} external)</span>
          <span>Tables: {{ dashboardData?.overview?.totalTablesCount ?? 0 }}</span>
        </div>
      </div>

      <!-- Request Volume & Cache Performance Timeline -->
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 lg:col-span-2 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 class="w-4 h-4 text-yellow-400" />
              24-Hour Request & SemAPI Volume
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Aggregated API lookups, cache hits, and serverless SemAPI executions</p>
          </div>
          <span class="text-xs font-mono text-violet-400">Live Telemetry</span>
        </div>

        <!-- SVG Timeline Chart -->
        <div class="h-48 w-full relative pt-4 flex items-end gap-1.5 justify-between select-none">
          <div
            v-for="(item, idx) in dashboardData?.timeline"
            :key="idx"
            class="flex-1 flex flex-col items-center gap-1 group relative"
          >
            <!-- Tooltip -->
            <div class="absolute -top-12 bg-slate-900 border border-slate-700 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap shadow-xl">
              {{ item.hour }}: {{ item.requests }} reqs ({{ item.cacheHits }} hits)
            </div>

            <!-- Bar -->
            <div class="w-full flex flex-col justify-end items-center h-36">
              <div
                class="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-pink-500 group-hover:brightness-125 transition-all"
                :style="{ height: `${Math.min(100, Math.max(15, (item.requests / 220) * 100))}%` }"
              ></div>
            </div>
            <span class="text-[9px] font-mono text-slate-400 scale-90">{{ idx % 4 === 0 ? item.hour : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Section: Quick Actions & Top Tracks -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quick Actions -->
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <Zap class="w-4 h-4 text-pink-400" />
          Quick Management Actions
        </h3>

        <div class="grid grid-cols-1 gap-2.5">
          <router-link
            to="/admin/semapi"
            class="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition group"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xs">JS</div>
              <div>
                <h5 class="text-xs font-bold text-white group-hover:text-pink-300 transition">Create SemAPI Route</h5>
                <p class="text-[11px] text-slate-400">Write custom JavaScript API handlers</p>
              </div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </router-link>

          <router-link
            to="/admin/nodes"
            class="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition group"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">ND</div>
              <div>
                <h5 class="text-xs font-bold text-white group-hover:text-cyan-300 transition">Add Storage Node</h5>
                <p class="text-[11px] text-slate-400">Provision isolated database partition</p>
              </div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </router-link>

          <router-link
            to="/admin/cache"
            class="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition group"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">YT</div>
              <div>
                <h5 class="text-xs font-bold text-white group-hover:text-red-300 transition">YouTube Cache Console</h5>
                <p class="text-[11px] text-slate-400">Inspect & warm video ID mappings</p>
              </div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </router-link>
        </div>
      </div>

      <!-- Top Queried Lyrics -->
      <div class="glass-panel rounded-3xl p-6 border border-slate-800 lg:col-span-2 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <Music class="w-4 h-4 text-emerald-400" />
            Top Queried Tracks Across Partitions
          </h3>
          <router-link to="/admin/lyrics" class="text-xs text-violet-400 hover:text-violet-300 font-semibold">
            All Lyrics →
          </router-link>
        </div>

        <div class="divide-y divide-slate-800/80">
          <div
            v-for="track in dashboardData?.topTracks"
            :key="`${track.node_id}-${track.id}`"
            class="py-3 flex items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-violet-400 font-bold text-xs shrink-0">
                <Music class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h5 class="text-xs font-bold text-white truncate">{{ track.title }}</h5>
                <p class="text-[11px] text-slate-400 truncate">{{ track.artist }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span class="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {{ track.node_id }}
              </span>
              <span class="text-xs font-mono font-bold text-slate-300">
                {{ track.views_count?.toLocaleString() }} views
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MetricCard from '../../components/MetricCard.vue';
import {
  Music,
  Zap,
  Youtube,
  HardDrive,
  Layers,
  BarChart3,
  RefreshCw,
  ArrowRight,
  BrainCircuit,
  Sparkles,
} from 'lucide-vue-next';
import { useSystemStore } from '../../stores/system.store.js';

const systemStore = useSystemStore();
const dashboardData = ref<any>(null);
const refreshing = ref<boolean>(false);
const trainingMinai = ref<boolean>(false);

async function trainMinai() {
  trainingMinai.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/minai/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      systemStore.addToast('MIN-AI Trained', data.message || 'Model rebuilt from catalog.', 'success');
      await refreshDashboard();
    } else {
      systemStore.addToast('Training Failed', data.error || 'Could not train model.', 'error');
    }
  } catch (err: any) {
    systemStore.addToast('Error', err.message, 'error');
  } finally {
    trainingMinai.value = false;
  }
}

onMounted(async () => {
  await refreshDashboard();
});

async function refreshDashboard() {
  refreshing.value = true;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/stats/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.data) {
      dashboardData.value = data.data;
    }
  } catch {} finally {
    refreshing.value = false;
  }
}
</script>
