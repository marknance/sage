import { create } from 'zustand';
import { api } from '../lib/api';

export interface Backend {
  id: number;
  user_id: number;
  name: string;
  type: string;
  base_url: string | null;
  org_id: string | null;
  is_active: number;
  has_api_key: boolean;
  created_at: string;
}

interface TestResult {
  success: boolean;
  model_count?: number;
  error?: string;
}

interface BackendState {
  backends: Backend[];
  currentBackend: Backend | null;
  models: string[];
  isLoading: boolean;
  testResult: TestResult | null;

  fetchBackends: () => Promise<void>;
  fetchBackend: (id: number) => Promise<void>;
  createBackend: (data: Partial<Backend> & { api_key?: string }) => Promise<Backend>;
  updateBackend: (id: number, data: Partial<Backend> & { api_key?: string }) => Promise<void>;
  deleteBackend: (id: number) => Promise<void>;
  testBackend: (id: number) => Promise<TestResult>;
  fetchModels: (id: number) => Promise<void>;
  clearTestResult: () => void;
}

export const useBackendStore = create<BackendState>((set) => ({
  backends: [],
  currentBackend: null,
  models: [],
  isLoading: false,
  testResult: null,

  fetchBackends: async () => {
    set({ isLoading: true });
    try {
      const { backends } = await api<{ backends: Backend[] }>('/api/backends');
      set({ backends, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchBackend: async (id) => {
    set({ isLoading: true });
    try {
      const data = await api<{ backend: Backend; expert_count: number }>(`/api/backends/${id}`);
      set({ currentBackend: data.backend, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createBackend: async (data) => {
    const { backend } = await api<{ backend: Backend }>('/api/backends', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return backend;
  },

  updateBackend: async (id, data) => {
    const { backend } = await api<{ backend: Backend }>(`/api/backends/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    set({ currentBackend: backend });
  },

  deleteBackend: async (id) => {
    await api(`/api/backends/${id}`, { method: 'DELETE' });
    set((s) => ({ backends: s.backends.filter((b) => b.id !== id), currentBackend: null }));
  },

  testBackend: async (id) => {
    const result = await api<TestResult>(`/api/backends/${id}/test`, { method: 'POST' });
    set({ testResult: result });
    return result;
  },

  fetchModels: async (id) => {
    try {
      const { models } = await api<{ models: string[] }>(`/api/backends/${id}/models`);
      set({ models });
    } catch {
      set({ models: [] });
    }
  },

  clearTestResult: () => set({ testResult: null }),
}));
