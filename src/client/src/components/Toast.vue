<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
    <transition-group
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-4 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="toast in systemStore.toasts"
        :key="toast.id"
        class="pointer-events-auto p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md"
        :class="getToastClass(toast.type)"
      >
        <component :is="getIcon(toast.type)" class="w-5 h-5 shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-sm leading-tight text-white">{{ toast.title }}</h4>
          <p v-if="toast.message" class="text-xs text-slate-300 mt-1 leading-relaxed">{{ toast.message }}</p>
        </div>
        <button
          @click="systemStore.removeToast(toast.id)"
          class="text-slate-400 hover:text-white p-1 -mr-1 -mt-1 rounded-lg transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useSystemStore, type ToastItem } from '../stores/system.store.js';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-vue-next';

const systemStore = useSystemStore();

function getToastClass(type: ToastItem['type']) {
  switch (type) {
    case 'success':
      return 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300';
    case 'error':
      return 'bg-rose-950/90 border-rose-500/40 text-rose-300';
    case 'warning':
      return 'bg-amber-950/90 border-amber-500/40 text-amber-300';
    default:
      return 'bg-slate-900/90 border-violet-500/40 text-violet-300';
  }
}

function getIcon(type: ToastItem['type']) {
  switch (type) {
    case 'success':
      return CheckCircle2;
    case 'error':
      return AlertCircle;
    case 'warning':
      return AlertTriangle;
    default:
      return Info;
  }
}
</script>
