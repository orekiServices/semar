<template>
  <aside class="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col h-screen sticky top-0 shrink-0 select-none z-20">
    <!-- Header Logo & Status -->
    <div class="p-5 border-b border-slate-800/80 flex items-center justify-between">
      <router-link to="/admin/dashboard" class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-violet-600/30">
          <HeartHandshake class="w-4 h-4 text-pink-200" />
        </div>
        <div>
          <h2 class="font-bold text-sm text-white tracking-tight leading-none">Semar Admin</h2>
          <span class="text-[10px] font-mono text-violet-400">Control Panel</span>
        </div>
      </router-link>
      <router-link
        to="/"
        class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="View Public Site"
      >
        <ExternalLink class="w-4 h-4" />
      </router-link>
    </div>

    <!-- Navigation Menu (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-3 space-y-6">
      <!-- Section: Core Administration -->
      <div>
        <span class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Core Management</span>
        <div class="mt-2 space-y-1">
          <router-link
            to="/admin/dashboard"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/dashboard') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <LayoutDashboard class="w-4 h-4 text-violet-400 group-hover:text-white" />
            Dashboard
          </router-link>

          <router-link
            to="/admin/setup"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/setup') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Wrench class="w-4 h-4 text-amber-400" />
            Admin Setup
          </router-link>

          <router-link
            to="/admin/semapi"
            class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/semapi') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <div class="flex items-center gap-2.5">
              <Zap class="w-4 h-4 text-pink-400" />
              SemAPI Studio
            </div>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">JS</span>
          </router-link>
        </div>
      </div>

      <!-- Section: Node & Content -->
      <div>
        <span class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nodes & Lyrics Engine</span>
        <div class="mt-2 space-y-1">
          <router-link
            to="/admin/nodes"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/nodes') && !isNodeDetail ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Layers class="w-4 h-4 text-cyan-400" />
            Semar Nodes
          </router-link>

          <router-link
            to="/admin/nodes/akai"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isNodeDetail ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <FolderTree class="w-4 h-4 text-indigo-400" />
            Node Details
          </router-link>

          <router-link
            to="/admin/lyrics"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/lyrics') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Music class="w-4 h-4 text-emerald-400" />
            Lyrics Database
          </router-link>

          <router-link
            to="/admin/cache"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/cache') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <HardDrive class="w-4 h-4 text-red-400" />
            YouTube Cache
          </router-link>
        </div>
      </div>

      <!-- Section: Customization & Branding -->
      <div>
        <span class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Customization & UI</span>
        <div class="mt-2 space-y-1">
          <router-link
            to="/admin/about"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/about') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Info class="w-4 h-4 text-blue-400" />
            About Page
          </router-link>

          <router-link
            to="/admin/branding"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/branding') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Palette class="w-4 h-4 text-pink-400" />
            Branding & Theme
          </router-link>

          <router-link
            to="/admin/custom-pages"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/custom-pages') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <FileCode class="w-4 h-4 text-teal-400" />
            Custom Pages
          </router-link>

          <router-link
            to="/admin/api-docs"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/api-docs') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <BookOpen class="w-4 h-4 text-violet-400" />
            API Documentation
          </router-link>
        </div>
      </div>

      <!-- Section: System & Analytics -->
      <div>
        <span class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">System & Analytics</span>
        <div class="mt-2 space-y-1">
          <router-link
            to="/admin/statistics"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/statistics') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <BarChart3 class="w-4 h-4 text-yellow-400" />
            Statistics & Metrics
          </router-link>

          <router-link
            to="/admin/logs"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/logs') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <ScrollText class="w-4 h-4 text-slate-400" />
            Server & Audit Logs
          </router-link>

          <router-link
            to="/admin/database"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/database') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Database class="w-4 h-4 text-blue-400" />
            Database Console
          </router-link>

          <router-link
            to="/admin/security"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/security') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <ShieldAlert class="w-4 h-4 text-rose-400" />
            Security & API Keys
          </router-link>

          <router-link
            to="/admin/settings"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
            :class="isActive('/admin/settings') ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-300 hover:text-white hover:bg-slate-900'"
          >
            <Sliders class="w-4 h-4 text-slate-400" />
            System Settings
          </router-link>
        </div>
      </div>
    </div>

    <!-- User Profile Footer -->
    <div class="p-3 border-t border-slate-800/80 bg-slate-900/40">
      <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/40 text-violet-300 flex items-center justify-center font-bold text-xs shrink-0">
            A
          </div>
          <div class="min-w-0">
            <h5 class="text-xs font-bold text-white truncate">{{ authStore.user?.username || 'admin' }}</h5>
            <span class="text-[10px] text-emerald-400 block -mt-0.5">● Superadmin</span>
          </div>
        </div>
        <button
          @click="logout"
          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          title="Sign Out"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store.js';
import { useSystemStore } from '../stores/system.store.js';
import {
  HeartHandshake,
  ExternalLink,
  LayoutDashboard,
  Wrench,
  Zap,
  Layers,
  FolderTree,
  Music,
  HardDrive,
  Info,
  Palette,
  FileCode,
  BookOpen,
  BarChart3,
  ScrollText,
  Database,
  ShieldAlert,
  Sliders,
  LogOut,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();

function isActive(path: string): boolean {
  return route.path === path;
}

const isNodeDetail = computed(() => {
  return route.path.startsWith('/admin/nodes/') && route.path !== '/admin/nodes';
});

function logout() {
  authStore.logout();
  systemStore.addToast('Signed out', 'You have been logged out of the admin panel.', 'info');
  router.push('/');
}
</script>
