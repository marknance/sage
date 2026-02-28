import { create } from 'zustand';
import { api } from '../lib/api';
import { toast } from './toastStore';

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at?: string;
}

interface TagState {
  tags: Tag[];
  fetchTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag>;
  deleteTag: (id: number) => Promise<void>;
  addTagToConversation: (conversationId: number, tagId: number) => Promise<Tag[]>;
  removeTagFromConversation: (conversationId: number, tagId: number) => Promise<Tag[]>;
}

export const useTagStore = create<TagState>((set) => ({
  tags: [],

  fetchTags: async () => {
    try {
      const { tags } = await api<{ tags: Tag[] }>('/api/tags');
      set({ tags });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tags');
    }
  },

  createTag: async (name, color) => {
    const { tag } = await api<{ tag: Tag }>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  deleteTag: async (id) => {
    await api(`/api/tags/${id}`, { method: 'DELETE' });
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
    toast.success('Tag deleted');
  },

  addTagToConversation: async (conversationId, tagId) => {
    const { tags } = await api<{ tags: Tag[] }>(`/api/tags/conversations/${conversationId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
    return tags;
  },

  removeTagFromConversation: async (conversationId, tagId) => {
    const { tags } = await api<{ tags: Tag[] }>(`/api/tags/conversations/${conversationId}/tags/${tagId}`, {
      method: 'DELETE',
    });
    return tags;
  },
}));
