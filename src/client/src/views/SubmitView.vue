<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-8 py-10">
    <div class="text-center space-y-2 mb-8">
      <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
        <Upload class="w-3.5 h-3.5" />
        Community Contribution
      </span>
      <h2 class="text-3xl sm:text-4xl font-black text-white tracking-tight">Submit Lyrics</h2>
      <p class="text-sm text-slate-400 max-w-xl mx-auto">
        Share synchronized lyrics with the community. Submissions are reviewed by moderators before publishing to a node.
      </p>
    </div>

    <!-- Success State -->
    <div v-if="submitted" class="glass-panel rounded-3xl p-10 border border-emerald-500/30 text-center space-y-4">
      <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mx-auto">
        <CheckCircle2 class="w-8 h-8" />
      </div>
      <h3 class="text-xl font-bold text-white">Submission received!</h3>
      <p class="text-sm text-slate-400">
        "{{ submittedTitle }}" is now pending moderator review. It will appear in the catalog once approved.
      </p>
      <div class="flex items-center justify-center gap-3 pt-2">
        <button
          @click="resetForm"
          class="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
        >
          Submit Another
        </button>
        <router-link
          to="/"
          class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
        >
          Back to Search
        </router-link>
      </div>
    </div>

    <!-- Submission Form -->
    <form v-else @submit.prevent="handleSubmit" class="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Target Node *</label>
          <select
            v-model="form.node_id"
            required
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          >
            <option value="" disabled>Select a node...</option>
            <option v-for="node in nodes" :key="node.node_id" :value="node.node_id">
              {{ node.name }} ({{ node.node_id }})
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Your Name</label>
          <input
            v-model="form.submitter_name"
            type="text"
            maxlength="128"
            placeholder="Anonymous"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Song Title *</label>
          <input
            v-model="form.title"
            type="text"
            required
            placeholder="e.g. Gurenge (紅蓮華)"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Artist *</label>
          <input
            v-model="form.artist"
            type="text"
            required
            placeholder="e.g. LiSA"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Album</label>
          <input
            v-model="form.album"
            type="text"
            placeholder="Album name"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">YouTube Video ID</label>
          <input
            v-model="form.youtube_video_id"
            type="text"
            placeholder="e.g. CwkzK-Fh400"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Duration (sec)</label>
          <input
            v-model.number="form.duration"
            type="number"
            min="0"
            placeholder="238"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1.5">Plain Lyrics</label>
        <textarea
          v-model="form.plain_lyrics"
          rows="5"
          placeholder="Unsynchronized full lyrics text..."
          class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500 font-serif"
        ></textarea>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1.5">
          Synced LRC Lyrics
          <span class="text-emerald-400 font-bold">· recommended</span>
        </label>
        <textarea
          v-model="form.synced_lyrics"
          rows="6"
          placeholder="[00:04.12]Tsuyoku nareru riyuu wo shitta&#10;[00:08.85]Boku wo tsurete susume"
          class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
        ></textarea>
        <p class="text-[11px] text-slate-500 mt-1.5">At least one lyrics payload (plain or synced) is required. Apple Music TTML is auto-generated from LRC on approval.</p>
      </div>

      <p v-if="error" class="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Send class="w-4 h-4" />
        {{ submitting ? 'Submitting...' : 'Submit for Review' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../stores/system.store.js';
import { Upload, CheckCircle2, Send } from 'lucide-vue-next';

const systemStore = useSystemStore();

const nodes = ref<any[]>([]);
const submitting = ref<boolean>(false);
const submitted = ref<boolean>(false);
const submittedTitle = ref<string>('');
const error = ref<string>('');

const form = ref<any>({
  node_id: '',
  title: '',
  artist: '',
  album: '',
  youtube_video_id: '',
  duration: 0,
  plain_lyrics: '',
  synced_lyrics: '',
  submitter_name: '',
});

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/nodes');
    const data = await res.json();
    if (data.nodes) {
      nodes.value = data.nodes.filter((n: any) => n.status === 'active' && !n.is_special);
    }
  } catch {}
});

async function handleSubmit() {
  error.value = '';
  submitting.value = true;
  try {
    const res = await fetch('/api/v1/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Submission failed');
    }
    submitted.value = true;
    submittedTitle.value = form.value.title;
    systemStore.addToast('Submitted!', 'Your lyrics are pending moderator review.', 'success');
  } catch (err: any) {
    error.value = err.message || 'Submission failed';
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  submitted.value = false;
  submittedTitle.value = '';
  form.value = {
    node_id: '',
    title: '',
    artist: '',
    album: '',
    youtube_video_id: '',
    duration: 0,
    plain_lyrics: '',
    synced_lyrics: '',
    submitter_name: '',
  };
}
</script>
