import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.store.js';

// Public Views
import HomeView from '../views/HomeView.vue';
import LyricsDetailView from '../views/LyricsDetailView.vue';
import SetupView from '../views/SetupView.vue';
import PublicNodesView from '../views/PublicNodesView.vue';
import PublicNodeDetailView from '../views/PublicNodeDetailView.vue';
import PublicAboutView from '../views/PublicAboutView.vue';
import PublicDocsView from '../views/PublicDocsView.vue';
import CustomPageView from '../views/CustomPageView.vue';

// Admin Views
import DashboardView from '../views/admin/DashboardView.vue';
import AdminSetupView from '../views/admin/AdminSetupView.vue';
import SemApiView from '../views/admin/SemApiView.vue';
import NodesView from '../views/admin/NodesView.vue';
import NodeDetailView from '../views/admin/NodeDetailView.vue';
import LyricsDbView from '../views/admin/LyricsDbView.vue';
import CacheView from '../views/admin/CacheView.vue';
import AboutConfigView from '../views/admin/AboutConfigView.vue';
import BrandingView from '../views/admin/BrandingView.vue';
import CustomPagesView from '../views/admin/CustomPagesView.vue';
import ApiDocsView from '../views/admin/ApiDocsView.vue';
import LogsView from '../views/admin/LogsView.vue';
import StatisticsView from '../views/admin/StatisticsView.vue';
import DatabaseView from '../views/admin/DatabaseView.vue';
import SecurityView from '../views/admin/SecurityView.vue';
import SettingsView from '../views/admin/SettingsView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/lyrics/:nodeId/:id', name: 'lyrics-detail', component: LyricsDetailView },
    { path: '/setup', name: 'setup', component: SetupView },
    { path: '/nodes', name: 'public-nodes', component: PublicNodesView },
    { path: '/nodes/:nodeId', name: 'public-node-detail', component: PublicNodeDetailView },
    { path: '/about', name: 'public-about', component: PublicAboutView },
    { path: '/docs', name: 'public-docs', component: PublicDocsView },
    { path: '/p/:slug', name: 'custom-page', component: CustomPageView },

    // Admin Suite
    { path: '/admin', redirect: '/admin/dashboard' },
    { path: '/admin/dashboard', name: 'admin-dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/admin/setup', name: 'admin-setup', component: AdminSetupView, meta: { requiresAuth: true } },
    { path: '/admin/semapi', name: 'admin-semapi', component: SemApiView, meta: { requiresAuth: true } },
    { path: '/admin/nodes', name: 'admin-nodes', component: NodesView, meta: { requiresAuth: true } },
    { path: '/admin/nodes/:id', name: 'admin-node-detail', component: NodeDetailView, meta: { requiresAuth: true } },
    { path: '/admin/lyrics', name: 'admin-lyrics', component: LyricsDbView, meta: { requiresAuth: true } },
    { path: '/admin/cache', name: 'admin-cache', component: CacheView, meta: { requiresAuth: true } },
    { path: '/admin/about', name: 'admin-about', component: AboutConfigView, meta: { requiresAuth: true } },
    { path: '/admin/branding', name: 'admin-branding', component: BrandingView, meta: { requiresAuth: true } },
    { path: '/admin/custom-pages', name: 'admin-custom-pages', component: CustomPagesView, meta: { requiresAuth: true } },
    { path: '/admin/api-docs', name: 'admin-api-docs', component: ApiDocsView, meta: { requiresAuth: true } },
    { path: '/admin/logs', name: 'admin-logs', component: LogsView, meta: { requiresAuth: true } },
    { path: '/admin/statistics', name: 'admin-statistics', component: StatisticsView, meta: { requiresAuth: true } },
    { path: '/admin/database', name: 'admin-database', component: DatabaseView, meta: { requiresAuth: true } },
    { path: '/admin/security', name: 'admin-security', component: SecurityView, meta: { requiresAuth: true } },
    { path: '/admin/settings', name: 'admin-settings', component: SettingsView, meta: { requiresAuth: true } },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Check if first-time setup is needed
  if (to.name !== 'setup') {
    const status = await authStore.checkSetup();
    if (status && status.setupCompleted === false) {
      return next({ name: 'setup' });
    }
  }

  // Check auth requirement for admin
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'home', query: { openLogin: 'true', redirect: to.fullPath } });
  }

  next();
});

export default router;
