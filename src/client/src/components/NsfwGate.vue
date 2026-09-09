<template>
  <div v-if="!confirmed" class="glass-panel p-8 rounded-3xl border border-rose-500/30 text-center max-w-xl mx-auto my-8 shadow-2xl relative overflow-hidden">
    <div class="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto mb-4">
      <AlertTriangle class="w-8 h-8" />
    </div>
    <span class="text-xs font-bold uppercase tracking-widest text-rose-400 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30">
      Age-Restricted Partition (18+)
    </span>
    <h3 class="text-2xl font-black text-white mt-4 mb-2">Mature Content Warning</h3>
    <p class="text-sm text-slate-300 leading-relaxed mb-6">
      This <span class="font-bold text-rose-300">mature (18+) node</span> and tagged explicit tracks contain uncensored explicit lyrics, heavy language, or underground themes.
      Please confirm you are at least 18 years of age to proceed.
    </p>

    <div class="flex items-center justify-center gap-4">
      <button
        @click="confirmAge"
        class="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
      >
        <Check class="w-4 h-4" />
        I am 18 or older — Enter
      </button>
      <button
        @click="$router.push('/')"
        class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition"
      >
        Return to Safe Catalog
      </button>
    </div>
  </div>
  <div v-else>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AlertTriangle, Check } from 'lucide-vue-next';

const confirmed = ref<boolean>(false);

onMounted(() => {
  const stored = localStorage.getItem('semar_nsfw_confirmed');
  if (stored === 'true') {
    confirmed.value = true;
  }
});

function confirmAge() {
  confirmed.value = true;
  localStorage.setItem('semar_nsfw_confirmed', 'true');
}
</script>
