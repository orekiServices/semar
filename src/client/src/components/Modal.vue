<template>
  <teleport to="body">
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="fixed inset-0" @click="close"></div>
        <div
          class="relative bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full overflow-hidden transform transition-all z-10 flex flex-col max-h-[90vh]"
          :class="maxWidthClass"
        >
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <slot name="header">
              <h3 class="text-lg font-bold text-white">{{ title }}</h3>
            </slot>
            <button
              @click="close"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto flex-1">
            <slot></slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  }>(),
  {
    title: '',
    size: 'lg',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'close'): void;
}>();

const maxWidthClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'max-w-md';
    case 'md': return 'max-w-lg';
    case 'lg': return 'max-w-2xl';
    case 'xl': return 'max-w-3xl';
    case '2xl': return 'max-w-5xl';
    case '4xl': return 'max-w-6xl';
    case 'full': return 'max-w-[95vw]';
    default: return 'max-w-2xl';
  }
});

function close() {
  emit('update:modelValue', false);
  emit('close');
}
</script>
