import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('semar_token'));
  const user = ref<any>(null);
  const setupCompleted = ref<boolean>(true);
  const loading = ref<boolean>(false);

  const isAuthenticated = computed(() => Boolean(token.value));

  async function checkSetup() {
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      setupCompleted.value = data.setupCompleted;
      return data;
    } catch {
      return { setupCompleted: true };
    }
  }

  async function login(username: string, passwordPlain: string) {
    loading.value = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: passwordPlain }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      token.value = data.token;
      user.value = data.user;
      localStorage.setItem('semar_token', data.token);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe() {
    if (!token.value) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      });
      if (!res.ok) {
        logout();
        return null;
      }
      const data = await res.json();
      user.value = data.user;
      return user.value;
    } catch {
      logout();
      return null;
    }
  }

  function setAuth(newToken: string, newUser: any) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('semar_token', newToken);
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('semar_token');
  }

  return {
    token,
    user,
    setupCompleted,
    loading,
    isAuthenticated,
    checkSetup,
    login,
    fetchMe,
    setAuth,
    logout,
  };
});
