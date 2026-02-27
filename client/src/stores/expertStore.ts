import { create } from 'zustand';
import { api } from '../lib/api';
import { toast } from './toastStore';

export interface Expert {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  domain: string;
  personality_tone: string;
  system_prompt: string | null;
  backend_id: number | null;
  model_override: string | null;
  memory_enabled: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  category_names?: string | null;
}

export interface Behavior {
  id: number;
  expert_id: number;
  behavior_key: string;
  enabled: number;
}

export interface Category {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  expert_count?: number;
}

export interface Memory {
  id: number;
  expert_id: number;
  memory_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ExpertState {
  experts: Expert[];
  currentExpert: Expert | null;
  behaviors: Behavior[];
  categories: Category[];
  memories: Memory[];
  allCategories: Category[];
  isLoading: boolean;

  fetchExperts: (params?: { search?: string; category?: string; sort?: string }) => Promise<void>;
  fetchExpert: (id: number) => Promise<void>;
  checkExpertUsage: (id: number) => Promise<{ conversation_count: number; message_count: number }>;
  createExpert: (data: Partial<Expert>) => Promise<Expert>;
  updateExpert: (id: number, data: Partial<Expert>) => Promise<void>;
  deleteExpert: (id: number) => Promise<void>;
  updateBehaviors: (id: number, behaviors: { behavior_key: string; enabled: number }[]) => Promise<void>;
  updateCategories: (id: number, categoryIds: number[]) => Promise<void>;
  fetchMemories: (id: number) => Promise<void>;
  addMemory: (id: number, memory_type: string, content: string) => Promise<void>;
  deleteMemory: (expertId: number, memoryId: number) => Promise<void>;
  clearMemories: (id: number) => Promise<void>;
  fetchAllCategories: () => Promise<void>;
  createCategory: (name: string) => Promise<Category>;
  renameCategory: (id: number, name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  cloneExpert: (id: number) => Promise<Expert>;
  exportExpert: (id: number) => Promise<void>;
  importExpert: (data: any, strategy: 'skip' | 'rename' | 'overwrite') => Promise<Expert>;
}

export const useExpertStore = create<ExpertState>((set, get) => ({
  experts: [],
  currentExpert: null,
  behaviors: [],
  categories: [],
  memories: [],
  allCategories: [],
  isLoading: false,

  fetchExperts: async (params) => {
    set({ isLoading: true });
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.category) query.set('category', params.category);
      if (params?.sort) query.set('sort', params.sort);
      const qs = query.toString();
      const { experts } = await api<{ experts: Expert[] }>(`/api/experts${qs ? `?${qs}` : ''}`);
      set({ experts, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || 'Failed to load experts');
    }
  },

  fetchExpert: async (id) => {
    set({ isLoading: true });
    try {
      const data = await api<{ expert: Expert; behaviors: Behavior[]; categories: Category[]; memoryCount: number }>(
        `/api/experts/${id}`
      );
      set({ currentExpert: data.expert, behaviors: data.behaviors, categories: data.categories, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || 'Failed to load expert');
    }
  },

  checkExpertUsage: async (id) => {
    return api<{ conversation_count: number; message_count: number }>(`/api/experts/${id}/usage`);
  },

  createExpert: async (data) => {
    const { expert } = await api<{ expert: Expert }>('/api/experts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return expert;
  },

  updateExpert: async (id, data) => {
    const { expert } = await api<{ expert: Expert }>(`/api/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    set({ currentExpert: expert });
    toast.success('Expert updated');
  },

  deleteExpert: async (id) => {
    await api(`/api/experts/${id}`, { method: 'DELETE' });
    set((s) => ({ experts: s.experts.filter((e) => e.id !== id), currentExpert: null }));
    toast.success('Expert deleted');
  },

  updateBehaviors: async (id, behaviors) => {
    const res = await api<{ behaviors: Behavior[] }>(`/api/experts/${id}/behaviors`, {
      method: 'PUT',
      body: JSON.stringify({ behaviors }),
    });
    set({ behaviors: res.behaviors });
  },

  updateCategories: async (id, categoryIds) => {
    const res = await api<{ categories: Category[] }>(`/api/experts/${id}/categories`, {
      method: 'PUT',
      body: JSON.stringify({ categoryIds }),
    });
    set({ categories: res.categories });
  },

  fetchMemories: async (id) => {
    const { memories } = await api<{ memories: Memory[] }>(`/api/experts/${id}/memories`);
    set({ memories });
  },

  addMemory: async (id, memory_type, content) => {
    const { memory } = await api<{ memory: Memory }>(`/api/experts/${id}/memories`, {
      method: 'POST',
      body: JSON.stringify({ memory_type, content }),
    });
    set((s) => ({ memories: [memory, ...s.memories] }));
  },

  deleteMemory: async (expertId, memoryId) => {
    await api(`/api/experts/${expertId}/memories/${memoryId}`, { method: 'DELETE' });
    set((s) => ({ memories: s.memories.filter((m) => m.id !== memoryId) }));
  },

  clearMemories: async (id) => {
    await api(`/api/experts/${id}/memories`, { method: 'DELETE' });
    set({ memories: [] });
  },

  fetchAllCategories: async () => {
    const { categories } = await api<{ categories: Category[] }>('/api/categories');
    set({ allCategories: categories });
  },

  createCategory: async (name) => {
    const { category } = await api<{ category: Category }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    set((s) => ({ allCategories: [...s.allCategories, category] }));
    return category;
  },

  renameCategory: async (id, name) => {
    const { category } = await api<{ category: Category }>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    set((s) => ({ allCategories: s.allCategories.map((c) => c.id === id ? category : c) }));
  },

  deleteCategory: async (id) => {
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    set((s) => ({ allCategories: s.allCategories.filter((c) => c.id !== id) }));
  },

  cloneExpert: async (id) => {
    const { expert } = await api<{ expert: Expert }>(`/api/experts/${id}/clone`, {
      method: 'POST',
    });
    toast.success(`Expert cloned as "${expert.name}"`);
    return expert;
  },

  exportExpert: async (id) => {
    const data = await api<any>(`/api/experts/${id}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.sage-expert.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Expert exported');
  },

  importExpert: async (data, strategy) => {
    const { expert } = await api<{ expert: Expert }>('/api/experts/import', {
      method: 'POST',
      body: JSON.stringify({ data, strategy }),
    });
    toast.success(`Expert "${expert.name}" imported`);
    return expert;
  },
}));
