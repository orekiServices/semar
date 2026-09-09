import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export const useSystemStore = defineStore('system', () => {
  const branding = ref<any>({
    siteName: '⁠♡ Semar',
    tagline: 'Self-Hosted Synchronized Lyrics Database & SemAPI Engine',
    description: 'Tailored lyrics database with PostgreSQL-native multi-node isolation, YouTube Video ID caching, and dynamic JavaScript SemAPI endpoints.',
    heroTitle: 'Find & Synchronize Every Lyric',
    heroSubtitle: 'Search your self-hosted lyric nodes, community libraries, and external providers — with millisecond LRC accuracy.',
    primaryColor: '#8b5cf6',
    secondaryColor: '#ec4899',
    footerText: 'Powered by Semar Engine ⁠♡ Written in TypeScript with Express & Vue 3',
  });

  const about = ref<any>(null);
  const toasts = ref<ToastItem[]>([]);
  const activeNodes = ref<any[]>([]);

  async function fetchPublicInfo() {
    try {
      const res = await fetch('/api/settings/public');
      const data = await res.json();
      if (data.branding && Object.keys(data.branding).length > 0) {
        branding.value = { ...branding.value, ...data.branding };
      }
      if (data.about) {
        about.value = data.about;
      }
    } catch {}

    try {
      const resNodes = await fetch('/api/v1/nodes');
      const dataNodes = await resNodes.json();
      if (dataNodes.nodes) {
        activeNodes.value = dataNodes.nodes;
      }
    } catch {}
  }

  function addToast(title: string, message?: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    toasts.value.push({ id, title, message, type });
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    branding,
    about,
    toasts,
    activeNodes,
    fetchPublicInfo,
    addToast,
    removeToast,
  };
});
