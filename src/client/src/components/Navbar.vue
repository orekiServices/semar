<template>
  <header class="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <!-- Brand Logo -->
      <router-link to="/" class="flex items-center gap-3 group">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 group-hover:scale-105 transition-transform duration-300">
          <HeartHandshake class="w-5 h-5 text-pink-200" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-black text-lg text-white tracking-tight group-hover:text-violet-300 transition-colors">
              {{ systemStore.branding.siteName || '⁠♡ Semar' }}
            </h1>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-wide">
              v2.2
            </span>
          </div>
          <p class="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">Self-Hosted Lyrics & SemAPI Engine</p>
        </div>
      </router-link>

      <!-- Navigation Links -->
      <nav class="hidden md:flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80">
        <router-link
          to="/"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          :class="$route.name === 'home' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'"
        >
          <Search class="w-3.5 h-3.5" />
          Lyrics Search
        </router-link>

        <router-link
          to="/nodes"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          :class="$route.name === 'public-nodes' || $route.name === 'public-node-detail' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'"
        >
          <Layers class="w-3.5 h-3.5" />
          Nodes
        </router-link>

        <router-link
          to="/docs"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          :class="$route.name === 'public-docs' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'"
        >
          <Code2 class="w-3.5 h-3.5" />
          API & SemAPI
        </router-link>

        <router-link
          to="/about"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          :class="$route.name === 'public-about' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'"
        >
          <Info class="w-3.5 h-3.5" />
          About
        </router-link>

        <router-link
          to="/submit"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          :class="$route.name === 'submit' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'"
        >
          <Upload class="w-3.5 h-3.5" />
          Submit
        </router-link>

        <router-link
          to="/ai"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          :class="$route.name === 'ai' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'"
        >
          <Sparkles class="w-3.5 h-3.5" />
          AI Studio
        </router-link>

        <router-link
          to="/p/terms"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition hidden lg:flex items-center gap-1.5"
        >
          <FileText class="w-3.5 h-3.5" />
          Guidelines
        </router-link>
      </nav>

      <!-- Action Portal Buttons -->
      <div class="flex items-center gap-2.5">
        <router-link
          v-if="authStore.isAuthenticated"
          to="/admin/dashboard"
          class="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 transition flex items-center gap-2 transform hover:scale-105 active:scale-95"
        >
          <ShieldCheck class="w-4 h-4" />
          Admin Panel
        </router-link>

        <button
          v-else
          @click="showLoginModal = true"
          class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition flex items-center gap-2"
        >
          <Lock class="w-4 h-4 text-violet-400" />
          Admin Login
        </button>

        <router-link
          to="/setup"
          class="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-800 transition"
          title="First Time Setup Wizard"
        >
          <Wrench class="w-4 h-4" />
        </router-link>
      </div>
    </div>

    <!-- Login Modal -->
    <Modal v-model="showLoginModal" title="Admin Authentication" size="sm">
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Admin Username</label>
          <input
            v-model="loginUsername"
            type="text"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
            placeholder="admin"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
          <input
            v-model="loginPassword"
            type="password"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
            placeholder="••••••••"
          />
        </div>
        <p v-if="loginError" class="text-xs text-rose-400 font-medium">{{ loginError }}</p>
        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-pink-500 disabled:opacity-50"
        >
          {{ authStore.loading ? 'Authenticating...' : 'Sign In to Admin Panel' }}
        </button>
      </form>
    </Modal>
  </header>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store.js';
import { useSystemStore } from '../stores/system.store.js';
import Modal from './Modal.vue';
import {
  HeartHandshake,
  Search,
  Layers,
  Code2,
  Info,
  FileText,
  ShieldCheck,
  Lock,
  Wrench,
  Upload,
  Sparkles,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();

const showLoginModal = ref<boolean>(false);
const loginUsername = ref<string>('admin');
const loginPassword = ref<string>('admin123456');
const loginError = ref<string>('');

watch(
  () => route.query.openLogin,
  (val) => {
    if (val === 'true') {
      showLoginModal.value = true;
    }
  },
  { immediate: true }
);

async function handleLogin() {
  loginError.value = '';
  try {
    await authStore.login(loginUsername.value, loginPassword.value);
    showLoginModal.value = false;
    systemStore.addToast('Welcome back, Admin!', 'Signed in successfully.', 'success');
    const redirect = (route.query.redirect as string) || '/admin/dashboard';
    router.push(redirect);
  } catch (err: any) {
    loginError.value = err.message || 'Login failed';
  }
}
</script>
