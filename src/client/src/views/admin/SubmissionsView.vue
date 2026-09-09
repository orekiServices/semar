<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Lyrics Submissions</h2>
        <p class="text-xs text-slate-400 mt-1">Community moderation queue — approve to publish into a node partition.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">{{ counts.pending }} pending</span>
        <span class="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{{ counts.approved }} approved</span>
        <span class="text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30">{{ counts.rejected }} rejected</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div class="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 w-fit">
        <button
          v-for="s in ['pending', 'approved', 'rejected', 'all']"
          :key="s"
          @click="statusFilter = s; page = 1; fetchSubmissions()"
          class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition capitalize"
          :class="statusFilter === s ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'"
        >
          {{ s }}
        </button>
      </div>
      <div class="relative flex-1">
        <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          v-model="search"
          @input="onSearchInput"
          type="text"
          placeholder="Search by title, artist, submitter..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
        />
      </div>
    </div>

    <!-- Table -->
    <div class="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
      <div v-if="loading" class="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
        <RefreshCw class="w-6 h-6 animate-spin text-violet-400" />
        Loading submissions...
      </div>
      <div v-else-if="items.length === 0" class="py-16 text-center space-y-2">
        <Inbox class="w-10 h-10 text-slate-600 mx-auto" />
        <p class="text-sm font-bold text-white">Queue is empty</p>
        <p class="text-xs text-slate-500">No {{ statusFilter }} submissions found.</p>
      </div>
      <table v-else class="w-full text-xs">
        <thead>
          <tr class="text-left text-slate-500 border-b border-slate-800/80">
            <th class="px-5 py-3.5 font-bold">Track</th>
            <th class="px-4 py-3.5 font-bold hidden md:table-cell">Target Node</th>
            <th class="px-4 py-3.5 font-bold hidden lg:table-cell">Submitter</th>
            <th class="px-4 py-3.5 font-bold hidden sm:table-cell">Status</th>
            <th class="px-5 py-3.5 font-bold text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="border-b border-slate-800/50 hover:bg-slate-900/40 transition">
            <td class="px-5 py-3.5">
              <div class="font-bold text-white">{{ item.title }}</div>
              <div class="text-slate-400 mt-0.5">{{ item.artist }} <span v-if="item.album" class="text-slate-500">• {{ item.album }}</span></div>
              <div class="flex items-center gap-1.5 mt-1">
                <span v-if="item.synced_lyrics" class="text-[10px] text-emerald-400 font-semibold">LRC</span>
                <span v-if="item.youtube_video_id" class="text-[10px] text-red-400 font-mono">{{ item.youtube_video_id }}</span>
              </div>
            </td>
            <td class="px-4 py-3.5 hidden md:table-cell">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-violet-500/15 text-violet-300 border border-violet-500/30">{{ item.node_id }}</span>
            </td>
            <td class="px-4 py-3.5 hidden lg:table-cell text-slate-400">
              {{ item.submitter_name || 'Anonymous' }}
              <div class="text-[10px] text-slate-500 font-mono">{{ formatDate(item.created_at) }}</div>
            </td>
            <td class="px-4 py-3.5 hidden sm:table-cell">
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                :class="statusClass(item.status)"
              >
                {{ item.status }}
              </span>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center justify-end gap-1.5">
                <button @click="openReview(item)" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="Review">
                  <Eye class="w-4 h-4" />
                </button>
                <button
                  v-if="item.status === 'pending'"
                  @click="quickApprove(item)"
                  class="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 transition"
                  title="Approve & publish"
                >
                  <Check class="w-4 h-4" />
                </button>
                <button
                  v-if="item.status === 'pending'"
                  @click="openReject(item)"
                  class="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 transition"
                  title="Reject"
                >
                  <X class="w-4 h-4" />
                </button>
                <button @click="deleteItem(item)" class="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition" title="Delete">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > limit" class="flex items-center justify-between px-5 py-4 border-t border-slate-800/80">
        <span class="text-[11px] text-slate-500">Showing {{ items.length }} of {{ total }}</span>
        <div class="flex items-center gap-2">
          <button @click="page--; fetchSubmissions()" :disabled="page <= 1" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40">Prev</button>
          <span class="text-xs text-slate-400 font-mono">Page {{ page }}</span>
          <button @click="page++; fetchSubmissions()" :disabled="page * limit >= total" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <Modal v-model="showReview" :title="`Review #${active?.id} — ${active?.title}`" size="xl">
      <div v-if="active" class="space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div class="bg-slate-900/60 p-3 rounded-xl"><span class="text-slate-500 block text-[10px]">Artist</span><span class="text-white font-bold">{{ active.artist }}</span></div>
          <div class="bg-slate-900/60 p-3 rounded-xl"><span class="text-slate-500 block text-[10px]">Target Node</span><span class="text-violet-300 font-bold uppercase">{{ active.node_id }}</span></div>
          <div class="bg-slate-900/60 p-3 rounded-xl"><span class="text-slate-500 block text-[10px]">Submitter</span><span class="text-white font-bold">{{ active.submitter_name || 'Anonymous' }}</span></div>
          <div class="bg-slate-900/60 p-3 rounded-xl"><span class="text-slate-500 block text-[10px]">YouTube ID</span><span class="text-white font-mono">{{ active.youtube_video_id || '—' }}</span></div>
        </div>

        <div v-if="active.plain_lyrics" class="space-y-1.5">
          <h4 class="text-xs font-bold text-slate-300">Plain Lyrics</h4>
          <pre class="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-3.5 max-h-40 overflow-y-auto whitespace-pre-wrap font-serif">{{ active.plain_lyrics }}</pre>
        </div>
        <div v-if="active.synced_lyrics" class="space-y-1.5">
          <h4 class="text-xs font-bold text-slate-300">Synced LRC</h4>
          <pre class="text-[11px] text-emerald-300/90 bg-slate-950 border border-slate-800 rounded-xl p-3.5 max-h-56 overflow-y-auto whitespace-pre-wrap font-mono">{{ active.synced_lyrics }}</pre>
        </div>

        <div v-if="active.status !== 'pending'" class="text-xs bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
          <span class="text-slate-500">Reviewed by {{ active.reviewed_by }}:</span>
          <span class="text-slate-300 font-medium"> {{ active.review_note || '—' }}</span>
        </div>

        <div v-if="active.status === 'pending'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Publish to Node (override)</label>
            <select v-model="approveNode" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500">
              <option v-for="n in nodes" :key="n.node_id" :value="n.node_id">{{ n.node_id }} — {{ n.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Review Note</label>
            <input v-model="reviewNote" type="text" placeholder="Optional note..." class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500" />
          </div>
        </div>

        <div v-if="active.status === 'pending'" class="flex items-center justify-end gap-2 pt-1">
          <button @click="showReview = false; openReject(active)" class="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5">
            <X class="w-4 h-4" /> Reject
          </button>
          <button @click="approveActive" :disabled="acting" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50">
            <Check class="w-4 h-4" /> {{ acting ? 'Publishing...' : 'Approve & Publish' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Reject Modal -->
    <Modal v-model="showRejectModal" title="Reject Submission" size="sm">
      <div class="space-y-4">
        <p class="text-xs text-slate-400">Reject <span class="text-white font-bold">"{{ rejectTarget?.title }}"</span>? The submitter will not be notified, but the note is kept in the audit trail.</p>
        <input v-model="rejectNote" type="text" placeholder="Reason (e.g. duplicate, wrong sync...)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500" />
        <div class="flex items-center justify-end gap-2">
          <button @click="showRejectModal = false" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
          <button @click="confirmReject" :disabled="acting" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50">{{ acting ? 'Rejecting...' : 'Confirm Reject' }}</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import { Search, RefreshCw, Inbox, Eye, Check, X, Trash2 } from 'lucide-vue-next';

const systemStore = useSystemStore();

const items = ref<any[]>([]);
const counts = ref<any>({ pending: 0, approved: 0, rejected: 0, total: 0 });
const nodes = ref<any[]>([]);
const loading = ref<boolean>(false);
const acting = ref<boolean>(false);
const statusFilter = ref<string>('pending');
const search = ref<string>('');
const page = ref<number>(1);
const limit = ref<number>(20);
const total = ref<number>(0);

const showReview = ref<boolean>(false);
const active = ref<any>(null);
const approveNode = ref<string>('');
const reviewNote = ref<string>('');

const showRejectModal = ref<boolean>(false);
const rejectTarget = ref<any>(null);
const rejectNote = ref<string>('');

let debounceTimer: any = null;

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('semar_token')}` };
}

onMounted(async () => {
  await fetchSubmissions();
  try {
    const res = await fetch('/api/v1/nodes', { headers: authHeaders() });
    const data = await res.json();
    if (data.nodes) nodes.value = data.nodes.filter((n: any) => n.status === 'active');
  } catch {}
});

function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    fetchSubmissions();
  }, 350);
}

async function fetchSubmissions() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit.value),
      search: search.value,
    });
    if (statusFilter.value !== 'all') params.set('status', statusFilter.value);
    const res = await fetch(`/api/admin/submissions?${params.toString()}`, { headers: authHeaders() });
    const data = await res.json();
    if (data.items) {
      items.value = data.items;
      total.value = data.total || 0;
      counts.value = data.counts || counts.value;
    }
  } catch {} finally {
    loading.value = false;
  }
}

function statusClass(status: string): string {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
  if (status === 'rejected') return 'bg-rose-500/15 text-rose-300 border border-rose-500/30';
  return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
}

function formatDate(ts: string): string {
  if (!ts) return '';
  try {
    return new Date(ts.replace(' ', 'T') + 'Z').toLocaleString();
  } catch {
    return ts;
  }
}

function openReview(item: any) {
  active.value = item;
  approveNode.value = item.node_id;
  reviewNote.value = '';
  showReview.value = true;
}

async function quickApprove(item: any) {
  acting.value = true;
  try {
    const res = await fetch(`/api/admin/submissions/${item.id}/approve`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Approve failed');
    systemStore.addToast('Published!', `"${item.title}" is now live in node ${data.submission.node_id}.`, 'success');
    await fetchSubmissions();
  } catch (err: any) {
    systemStore.addToast('Approve failed', err.message, 'error');
  } finally {
    acting.value = false;
  }
}

async function approveActive() {
  if (!active.value) return;
  acting.value = true;
  try {
    const res = await fetch(`/api/admin/submissions/${active.value.id}/approve`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: approveNode.value, review_note: reviewNote.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Approve failed');
    systemStore.addToast('Published!', `"${active.value.title}" is now live in node ${data.submission.node_id}.`, 'success');
    showReview.value = false;
    await fetchSubmissions();
  } catch (err: any) {
    systemStore.addToast('Approve failed', err.message, 'error');
  } finally {
    acting.value = false;
  }
}

function openReject(item: any) {
  rejectTarget.value = item;
  rejectNote.value = '';
  showRejectModal.value = true;
}

async function confirmReject() {
  if (!rejectTarget.value) return;
  acting.value = true;
  try {
    const res = await fetch(`/api/admin/submissions/${rejectTarget.value.id}/reject`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: rejectNote.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reject failed');
    systemStore.addToast('Rejected', `Submission #${rejectTarget.value.id} rejected.`, 'info');
    showRejectModal.value = false;
    await fetchSubmissions();
  } catch (err: any) {
    systemStore.addToast('Reject failed', err.message, 'error');
  } finally {
    acting.value = false;
  }
}

async function deleteItem(item: any) {
  if (!confirm(`Delete submission #${item.id} "${item.title}"?`)) return;
  try {
    await fetch(`/api/admin/submissions/${item.id}`, { method: 'DELETE', headers: authHeaders() });
    systemStore.addToast('Deleted', `Submission #${item.id} deleted.`, 'info');
    await fetchSubmissions();
  } catch {}
}
</script>
