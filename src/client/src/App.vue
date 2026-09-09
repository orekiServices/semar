<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
    <!-- Admin View Layout (Sidebar + Content) -->
    <div v-if="isAdminRoute" class="flex flex-1 overflow-hidden min-h-screen">
      <Sidebar />
      <main class="flex-1 overflow-y-auto bg-slate-900/50 p-6 lg:p-10 pb-28">
        <router-view />
      </main>
    </div>

    <!-- Public View Layout (Navbar + Content + Footer) -->
    <div v-else class="flex flex-col flex-1 pb-24">
      <Navbar />
      <main class="flex-1">
        <router-view />
      </main>

      <!-- Public Footer -->
      <footer class="mt-20 border-t border-slate-900 bg-slate-950/80 py-10 px-4 sm:px-8">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
              ⁠♡
            </div>
            <div>
              <p class="text-xs font-semibold text-white">{{ systemStore.branding.siteName || '⁠♡ Semar' }}</p>
              <p class="text-[11px] text-slate-400">{{ systemStore.branding.footerText || 'Self-hosted synchronized lyrics engine with PostgreSQL & SemAPI' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-6 text-xs text-slate-400">
            <router-link to="/nodes" class="hover:text-white transition">Nodes Directory</router-link>
            <router-link to="/docs" class="hover:text-white transition">API & SemAPI</router-link>
            <router-link to="/about" class="hover:text-white transition">About</router-link>
            <router-link to="/p/terms" class="hover:text-white transition">Terms & Privacy</router-link>
            <router-link to="/admin" class="text-violet-400 hover:text-violet-300 font-semibold transition">Admin Panel</router-link>
          </div>
        </div>
      </footer>
    </div>

    <!-- Synchronized Player Dock -->
    <Player />

    <!-- Global Floating Toast Notifications -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.store.js';
import { useSystemStore } from './stores/system.store.js';
import Navbar from './components/Navbar.vue';
import Sidebar from './components/Sidebar.vue';
import Player from './components/Player.vue';
import Toast from './components/Toast.vue';

const route = useRoute();
const authStore = useAuthStore();
const systemStore = useSystemStore();

const isAdminRoute = computed(() => {
  return route.path.startsWith('/admin');
});

onMounted(async () => {
  await systemStore.fetchPublicInfo();
  if (authStore.isAuthenticated) {
    await authStore.fetchMe();
  }
});
</script>
