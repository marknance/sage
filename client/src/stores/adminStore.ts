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

interface AdminConversation {
  id: number;
  title: string;
  type: string;
  username: string;
  message_count: number;
  created_at: string;
}

interface AdminExpert {
  id: number;
  name: string;
  domain: string;
  username: string;
  created_at: string;
}

interface AdminState {
  users: AdminUser[];
  stats: SystemStats | null;
  isLoading: boolean;
  adminConversations: AdminConversation[];
  adminConversationsTotal: number;
  adminExperts: AdminExpert[];
  adminExpertsTotal: number;

  fetchUsers: (params?: { search?: string }) => Promise<void>;
  updateUserRole: (id: number, role: string) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  resetUserPassword: (id: number) => Promise<string>;
  fetchStats: () => Promise<void>;
  fetchAdminConversations: (params?: { search?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchAdminExperts: (params?: { search?: string; limit?: number; offset?: number }) => Promise<void>;
  deleteAdminConversation: (id: number) => Promise<void>;
  deleteAdminExpert: (id: number) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  users: [],
  stats: null,
  isLoading: false,
  adminConversations: [],
  adminConversationsTotal: 0,
  adminExperts: [],
  adminExpertsTotal: 0,

  fetchUsers: async (params) => {
    set({ isLoading: true });
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      const qs = query.toString();
      const { users } = await api<{ users: AdminUser[] }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
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

  resetUserPassword: async (id) => {
    const { tempPassword } = await api<{ tempPassword: string }>(`/api/admin/users/${id}/password`, {
      method: 'PUT',
    });
    return tempPassword;
  },

  fetchStats: async () => {
    try {
      const stats = await api<SystemStats>('/api/admin/stats');
      set({ stats });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stats');
    }
  },

  fetchAdminConversations: async (params) => {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const qs = query.toString();
      const data = await api<{ conversations: AdminConversation[]; total: number }>(`/api/admin/conversations${qs ? `?${qs}` : ''}`);
      set({ adminConversations: data.conversations, adminConversationsTotal: data.total });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load conversations');
    }
  },

  fetchAdminExperts: async (params) => {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const qs = query.toString();
      const data = await api<{ experts: AdminExpert[]; total: number }>(`/api/admin/experts${qs ? `?${qs}` : ''}`);
      set({ adminExperts: data.experts, adminExpertsTotal: data.total });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load experts');
    }
  },

  deleteAdminConversation: async (id) => {
    await api(`/api/admin/conversations/${id}`, { method: 'DELETE' });
    set((s) => ({
      adminConversations: s.adminConversations.filter((c) => c.id !== id),
      adminConversationsTotal: s.adminConversationsTotal - 1,
    }));
    toast.success('Conversation deleted');
  },

  deleteAdminExpert: async (id) => {
    await api(`/api/admin/experts/${id}`, { method: 'DELETE' });
    set((s) => ({
      adminExperts: s.adminExperts.filter((e) => e.id !== id),
      adminExpertsTotal: s.adminExpertsTotal - 1,
    }));
    toast.success('Expert deleted');
  },
}));
