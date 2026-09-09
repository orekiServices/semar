<template>
  <div class="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8">
    <div class="max-w-3xl w-full glass-panel rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8 relative overflow-hidden">
      <!-- Background Ambient Glow -->
      <div class="absolute -top-24 -right-24 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -left-24 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Header -->
      <div class="text-center space-y-2 relative z-10">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white shadow-xl shadow-violet-600/30 mx-auto mb-3">
          <HeartHandshake class="w-7 h-7 text-pink-200" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Semar Setup Wizard</h2>
        <p class="text-xs sm:text-sm text-slate-400">Initialize your self-hosted lyrics engine with PostgreSQL & SemAPI</p>
      </div>

      <!-- Stepper Indicator -->
      <div class="flex items-center justify-between max-w-xl mx-auto px-2 relative z-10">
        <div
          v-for="(s, idx) in steps"
          :key="idx"
          class="flex flex-col items-center gap-1.5"
        >
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-300"
            :class="[
              currentStep === idx + 1
                ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white ring-4 ring-violet-500/20 shadow-lg shadow-violet-600/30'
                : currentStep > idx + 1
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            ]"
          >
            <Check v-if="currentStep > idx + 1" class="w-4 h-4 stroke-[3]" />
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <span class="text-[10px] font-semibold text-slate-400 hidden sm:block">{{ s }}</span>
        </div>
      </div>

      <!-- Step 1: Database Setup -->
      <div v-if="currentStep === 1" class="space-y-6 relative z-10">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Database class="w-5 h-5 text-violet-400" />
            Step 1: Database Configuration
          </h3>
          <p class="text-xs text-slate-400 mt-1">Select your production database engine. PostgreSQL is first-class and recommended.</p>
        </div>

        <!-- DB Engine selector -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label
            class="glass-card p-4 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center space-y-2"
            :class="dbType === 'postgres' ? 'border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-950/50' : 'border-slate-800 hover:border-slate-700'"
          >
            <input type="radio" v-model="dbType" value="postgres" class="sr-only" />
            <div class="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">PG</div>
            <span class="font-bold text-sm text-white">PostgreSQL</span>
            <span class="text-[11px] text-slate-400 leading-tight">First-Class, JSONB metadata, node partitioning, production ready.</span>
          </label>

          <label
            class="glass-card p-4 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center space-y-2"
            :class="dbType === 'mysql' ? 'border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-950/50' : 'border-slate-800 hover:border-slate-700'"
          >
            <input type="radio" v-model="dbType" value="mysql" class="sr-only" />
            <div class="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">MY</div>
            <span class="font-bold text-sm text-white">MySQL / MariaDB</span>
            <span class="text-[11px] text-slate-400 leading-tight">Standard relational storage with JSON column support.</span>
          </label>

          <label
            class="glass-card p-4 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center space-y-2"
            :class="dbType === 'pglite' ? 'border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-950/50' : 'border-slate-800 hover:border-slate-700'"
          >
            <input type="radio" v-model="dbType" value="pglite" class="sr-only" />
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">PG</div>
            <span class="font-bold text-sm text-white">PGlite (Embedded)</span>
            <span class="text-[11px] text-slate-400 leading-tight">Zero-config embedded Postgres. Ideal for demos & single-node deploys.</span>
          </label>
        </div>

        <!-- Connection string input -->
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-slate-300">
            {{ dbType === 'pglite' ? 'Data Directory (optional — blank = in-memory)' : 'Connection String (URL)' }}
          </label>
          <input
            v-model="dbConnectionString"
            type="text"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
            :placeholder="dbType === 'postgres' ? 'postgres://postgres:password@localhost:5432/semar' : dbType === 'mysql' ? 'mysql://root:password@localhost:3306/semar' : '(optional) ./data/pglite'"
          />
        </div>

        <!-- Connection Tester Button -->
        <div class="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div class="text-xs">
            <span v-if="testResult" :class="testResult.success ? 'text-emerald-400' : 'text-rose-400'" class="font-semibold flex items-center gap-1.5">
              <CheckCircle2 v-if="testResult.success" class="w-4 h-4" />
              <AlertCircle v-else class="w-4 h-4" />
              {{ testResult.success ? `Connected (${testResult.latencyMs}ms) • ${testResult.version || ''}` : `Failed: ${testResult.error}` }}
            </span>
            <span v-else class="text-slate-400">Test database connection before proceeding</span>
          </div>
          <button
            @click="testDb"
            :disabled="testingDb"
            class="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="testingDb ? 'animate-spin' : ''" />
            {{ testingDb ? 'Testing...' : 'Test Connection' }}
          </button>
        </div>
      </div>

      <!-- Step 2: Admin Account -->
      <div v-if="currentStep === 2" class="space-y-4 relative z-10">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck class="w-5 h-5 text-violet-400" />
            Step 2: Administrator Credentials
          </h3>
          <p class="text-xs text-slate-400 mt-1">Create the master superadmin credentials for your Semar control panel.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Superadmin Username</label>
            <input
              v-model="adminUsername"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
              placeholder="admin"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Master Password</label>
            <input
              v-model="adminPassword"
              type="password"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
              placeholder="Minimum 6 characters"
            />
          </div>
        </div>
      </div>

      <!-- Step 3: Semar Nodes Setup -->
      <div v-if="currentStep === 3" class="space-y-4 relative z-10">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Layers class="w-5 h-5 text-cyan-400" />
            Step 3: Nodes & External Libraries
          </h3>
          <p class="text-xs text-slate-400 mt-1">Semar starts empty — you create nodes after setup. Two read-only external libraries are always available.</p>
        </div>

        <div class="space-y-3">
          <div class="glass-card p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-sm text-white">Your own nodes</h4>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">created by you</span>
              </div>
              <p class="text-xs text-slate-400">Provision isolated partitions after setup (e.g. anime, kpop, indie) and import or submit lyrics into each.</p>
            </div>
            <Check class="w-5 h-5 text-emerald-400" />
          </div>

          <div class="glass-card p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-sm text-white">LRCLIB · lyrics.ovh</h4>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">external · read-only</span>
              </div>
              <p class="text-xs text-slate-400">Built-in special nodes that search third-party lyrics libraries live. Disable anytime in System Settings.</p>
            </div>
            <Check class="w-5 h-5 text-emerald-400" />
          </div>
        </div>
      </div>

      <!-- Step 4: Branding -->
      <div v-if="currentStep === 4" class="space-y-4 relative z-10">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Palette class="w-5 h-5 text-pink-400" />
            Step 4: Branding & Instance Identity
          </h3>
          <p class="text-xs text-slate-400 mt-1">Customize public branding and hero labels.</p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Site Name</label>
            <input
              v-model="siteName"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tagline</label>
            <input
              v-model="siteTagline"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
      </div>

      <!-- Step 5: Completed -->
      <div v-if="currentStep === 5" class="space-y-6 text-center py-6 relative z-10">
        <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2">
          <Sparkles class="w-8 h-8" />
        </div>
        <h3 class="text-2xl font-black text-white">Semar is Ready!</h3>
        <p class="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          Your multi-node isolated lyrics database, YouTube cache resolver, and SemAPI runtime have been configured successfully.
        </p>

        <button
          @click="finishAndLaunch"
          class="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-2xl shadow-violet-600/40 transition transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
        >
          <Rocket class="w-5 h-5" />
          Launch Semar Admin Control Panel
        </button>
      </div>

      <!-- Stepper Controls -->
      <div v-if="currentStep < 5" class="pt-6 border-t border-slate-800 flex items-center justify-between relative z-10">
        <button
          v-if="currentStep > 1"
          @click="currentStep--"
          class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
        >
          Back
        </button>
        <div v-else></div>

        <button
          @click="nextStep"
          :disabled="initializing"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2 disabled:opacity-50"
        >
          {{ currentStep === 4 ? (initializing ? 'Initializing...' : 'Complete Setup') : 'Continue' }}
          <ArrowRight v-if="!initializing" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store.js';
import { useSystemStore } from '../stores/system.store.js';
import confetti from 'canvas-confetti';
import {
  HeartHandshake,
  Check,
  Database,
  ShieldCheck,
  Layers,
  Palette,
  Sparkles,
  Rocket,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();

const steps = ['Database', 'Admin User', 'Nodes', 'Branding', 'Launch'];
const currentStep = ref<number>(1);

// Step 1: DB
const dbType = ref<'postgres' | 'mysql' | 'pglite'>('postgres');
const dbConnectionString = ref<string>('');
const testingDb = ref<boolean>(false);
const testResult = ref<any>(null);

// Step 2: Admin
const adminUsername = ref<string>('admin');
const adminPassword = ref<string>('admin123456');

// Step 4: Branding
const siteName = ref<string>('⁠♡ Semar');
const siteTagline = ref<string>('Self-Hosted Synchronized Lyrics Database & SemAPI Engine');

const initializing = ref<boolean>(false);

async function testDb() {
  testingDb.value = true;
  testResult.value = null;
  try {
    const res = await fetch('/api/setup/test-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: dbType.value,
        connectionString: dbConnectionString.value,
      }),
    });
    testResult.value = await res.json();
  } catch (err: any) {
    testResult.value = { success: false, error: err.message };
  } finally {
    testingDb.value = false;
  }
}

async function nextStep() {
  if (currentStep.value === 4) {
    // Perform initialize
    initializing.value = true;
    try {
      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: {
            type: dbType.value,
            connectionString: dbConnectionString.value,
          },
          admin: {
            username: adminUsername.value,
            password: adminPassword.value,
          },
          branding: {
            siteName: siteName.value,
            tagline: siteTagline.value,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        authStore.setAuth(data.token, data.user);
        currentStep.value = 5;
        // Confetti celebration
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        systemStore.addToast('Setup Failed', data.error || 'Failed to initialize system', 'error');
      }
    } catch (err: any) {
      systemStore.addToast('Error', err.message, 'error');
    } finally {
      initializing.value = false;
    }
    return;
  }
  currentStep.value++;
}

function finishAndLaunch() {
  systemStore.addToast('Setup Complete!', 'Welcome to Semar Admin Panel.', 'success');
  router.push('/admin/dashboard');
}
</script>
