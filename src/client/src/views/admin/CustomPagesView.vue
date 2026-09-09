<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">Custom Pages Manager</h2>
        <p class="text-xs text-slate-400 mt-1">Create and manage custom public or internal pages hosted under <code>/p/:slug</code>.</p>
      </div>

      <button
        @click="openCreateModal"
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        New Custom Page
      </button>
    </div>

    <!-- Table -->
    <div class="border border-slate-800 rounded-3xl overflow-hidden bg-slate-950 shadow-2xl">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono">
          <tr>
            <th class="p-3.5">Slug</th>
            <th class="p-3.5">Title</th>
            <th class="p-3.5">Published</th>
            <th class="p-3.5">Navbar</th>
            <th class="p-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900 text-slate-300">
          <tr v-for="page in pages" :key="page.slug" class="hover:bg-slate-900/40">
            <td class="p-3.5 font-mono text-violet-300 font-bold">/p/{{ page.slug }}</td>
            <td class="p-3.5 font-bold text-white">{{ page.title }}</td>
            <td class="p-3.5">
              <span :class="page.is_published ? 'text-emerald-400 font-bold' : 'text-slate-500'">
                {{ page.is_published ? 'Published' : 'Draft' }}
              </span>
            </td>
            <td class="p-3.5 text-slate-400">{{ page.show_in_navbar ? 'Yes' : 'No' }}</td>
            <td class="p-3.5 text-right">
              <div class="flex items-center justify-end gap-2">
                <a
                  :href="`/p/${page.slug}`"
                  target="_blank"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="View Live"
                >
                  <ExternalLink class="w-3.5 h-3.5" />
                </a>
                <button
                  @click="openEditModal(page)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Edit Page"
                >
                  <Edit3 class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="deletePage(page.slug)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Delete Page"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <Modal v-model="showModal" :title="isEditing ? 'Edit Custom Page' : 'Create Custom Page'" size="2xl">
      <form @submit.prevent="savePage" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Slug URL (/p/...)</label>
            <input
              v-model="form.slug"
              type="text"
              required
              :disabled="isEditing"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
              placeholder="terms, dmca, guidelines"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Page Title</label>
            <input
              v-model="form.title"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Markdown Content</label>
          <textarea
            v-model="form.content"
            rows="8"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-violet-200 text-xs font-mono focus:outline-none focus:border-violet-500"
          ></textarea>
        </div>

        <div class="flex items-center gap-6 pt-2">
          <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" v-model="form.is_published" class="rounded accent-violet-600" />
            <span>Published</span>
          </label>
          <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" v-model="form.show_in_navbar" class="rounded accent-violet-600" />
            <span>Show in Public Navigation Bar</span>
          </label>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            @click="showModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs"
          >
            Save Page
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../../stores/system.store.js';
import Modal from '../../components/Modal.vue';
import { Plus, Edit3, Trash2, ExternalLink } from 'lucide-vue-next';

const systemStore = useSystemStore();
const pages = ref<any[]>([]);
const showModal = ref<boolean>(false);
const isEditing = ref<boolean>(false);

const form = ref<any>({
  slug: '',
  title: '',
  content: '',
  is_published: true,
  show_in_navbar: false,
});

onMounted(fetchPages);

async function fetchPages() {
  try {
    const res = await fetch('/api/pages?all=true');
    const data = await res.json();
    pages.value = data.pages || [];
  } catch {}
}

function openCreateModal() {
  isEditing.value = false;
  form.value = {
    slug: '',
    title: '',
    content: '# New Page\n\nEnter page details here...',
    is_published: true,
    show_in_navbar: false,
  };
  showModal.value = true;
}

function openEditModal(page: any) {
  isEditing.value = true;
  form.value = { ...page };
  showModal.value = true;
}

async function savePage() {
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form.value),
    });
    if (res.ok) {
      systemStore.addToast('Saved', 'Custom page updated.', 'success');
      showModal.value = false;
      await fetchPages();
    }
  } catch {}
}

async function deletePage(slug: string) {
  if (!confirm(`Delete page "/p/${slug}"?`)) return;
  try {
    const token = localStorage.getItem('semar_token');
    const res = await fetch(`/api/admin/pages/${slug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      systemStore.addToast('Deleted', '', 'success');
      await fetchPages();
    }
  } catch {}
}
</script>
