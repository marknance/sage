import { create } from 'zustand';
import { api } from '../lib/api';
import { toast } from './toastStore';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface SystemStats {
  users: number;
  conversations: number;
  messages: number;
  experts: number;
  backends: number;
  db_size: number;
}

interface AdminState {
  users: AdminUser[];
  stats: SystemStats | null;
  isLoading: boolean;

  fetchUsers: () => Promise<void>;
  updateUserRole: (id: number, role: string) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  users: [],
  stats: null,
  isLoading: false,

  fetchUsers: async () => {
    set({ isLoading: true });
    try {
      const { users } = await api<{ users: AdminUser[] }>('/api/admin/users');
      set({ users, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || 'Failed to load users');
    }
  },

  updateUserRole: async (id, role) => {
    try {
      await api(`/api/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      set((s) => ({
        users: s.users.map((u) => (u.id === id ? { ...u, role } : u)),
      }));
      toast.success('Role updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  },

  deleteUser: async (id) => {
    try {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
      toast.success('User deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api<SystemStats>('/api/admin/stats');
      set({ stats });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stats');
    }
  },
}));
