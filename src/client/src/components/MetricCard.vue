<template>
  <div class="glass-card rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">{{ title }}</span>
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
        :class="iconBgClass"
      >
        <component :is="icon" class="w-5 h-5" :class="iconColorClass" />
      </div>
    </div>
    <div class="flex items-baseline gap-2">
      <h3 class="text-2xl font-extrabold text-white tracking-tight">{{ value }}</h3>
      <span v-if="unit" class="text-xs text-slate-400 font-medium">{{ unit }}</span>
    </div>
    <div v-if="subtext || trend" class="mt-2 flex items-center gap-1.5 text-xs">
      <span
        v-if="trend"
        class="font-semibold flex items-center"
        :class="trendPositive ? 'text-emerald-400' : 'text-rose-400'"
      >
        {{ trendPositive ? '↑' : '↓' }} {{ trend }}
      </span>
      <span v-if="subtext" class="text-slate-400 truncate">{{ subtext }}</span>
    </div>

    <!-- Subtle gradient background glow -->
    <div
      class="absolute -bottom-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40"
      :class="glowColorClass"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    value: string | number;
    unit?: string;
    subtext?: string;
    trend?: string;
    trendPositive?: boolean;
    icon: any;
    color?: 'violet' | 'pink' | 'emerald' | 'amber' | 'blue' | 'indigo' | 'rose' | 'cyan';
  }>(),
  {
    trendPositive: true,
    color: 'violet',
  }
);

const iconBgClass = computed(() => {
  switch (props.color) {
    case 'pink': return 'bg-pink-500/15 border border-pink-500/30';
    case 'emerald': return 'bg-emerald-500/15 border border-emerald-500/30';
    case 'amber': return 'bg-amber-500/15 border border-amber-500/30';
    case 'blue': return 'bg-blue-500/15 border border-blue-500/30';
    case 'indigo': return 'bg-indigo-500/15 border border-indigo-500/30';
    case 'rose': return 'bg-rose-500/15 border border-rose-500/30';
    case 'cyan': return 'bg-cyan-500/15 border border-cyan-500/30';
    default: return 'bg-violet-500/15 border border-violet-500/30';
  }
});

const iconColorClass = computed(() => {
  switch (props.color) {
    case 'pink': return 'text-pink-400';
    case 'emerald': return 'text-emerald-400';
    case 'amber': return 'text-amber-400';
    case 'blue': return 'text-blue-400';
    case 'indigo': return 'text-indigo-400';
    case 'rose': return 'text-rose-400';
    case 'cyan': return 'text-cyan-400';
    default: return 'text-violet-400';
  }
});

const glowColorClass = computed(() => {
  switch (props.color) {
    case 'pink': return 'bg-pink-500';
    case 'emerald': return 'bg-emerald-500';
    case 'amber': return 'bg-amber-500';
    case 'blue': return 'bg-blue-500';
    case 'indigo': return 'bg-indigo-500';
    case 'rose': return 'bg-rose-500';
    case 'cyan': return 'bg-cyan-500';
    default: return 'bg-violet-500';
  }
});
</script>
