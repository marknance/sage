import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  fetchUser: async () => {
    try {
      const { user } = await api<{ user: User }>('/api/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const { user } = await api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    set({ user, isAuthenticated: true });
  },

  register: async (username, email, password) => {
    const { user } = await api<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' });
    set({ user: null, isAuthenticated: false });
  },

  changePassword: async (currentPassword, newPassword) => {
    await api('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
}));
