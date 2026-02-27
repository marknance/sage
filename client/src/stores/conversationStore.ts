import { create } from 'zustand';
import { api } from '../lib/api';
import type { Expert } from './expertStore';

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  type: string;
  expert_debate_enabled: number;
  auto_suggest_experts: number;
  created_at: string;
  updated_at: string;
  expert_count?: number;
  last_message?: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  expert_id: number | null;
  role: 'user' | 'assistant';
  content: string;
  expert_name?: string | null;
  created_at: string;
}

export interface Document {
  id: number;
  conversation_id: number;
  filename: string;
  file_type: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface ConversationState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  experts: (Expert & { assignment_id: number })[];
  documents: Document[];
  suggestedExperts: Expert[];
  isLoading: boolean;
  isSending: boolean;

  fetchConversations: () => Promise<void>;
  fetchConversation: (id: number) => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  updateConversation: (id: number, data: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
  sendMessage: (id: number, content: string) => Promise<void>;
  assignExpert: (conversationId: number, expertId: number) => Promise<void>;
  removeExpert: (conversationId: number, expertId: number) => Promise<void>;
  uploadDocument: (conversationId: number, file: File) => Promise<void>;
  deleteDocument: (conversationId: number, docId: number) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  experts: [],
  documents: [],
  suggestedExperts: [],
  isLoading: false,
  isSending: false,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const { conversations } = await api<{ conversations: Conversation[] }>('/api/conversations');
      set({ conversations, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchConversation: async (id) => {
    set({ isLoading: true });
    try {
      const data = await api<{
        conversation: Conversation;
        experts: (Expert & { assignment_id: number })[];
        messages: Message[];
        documents: Document[];
      }>(`/api/conversations/${id}`);
      set({
        currentConversation: data.conversation,
        experts: data.experts,
        messages: data.messages,
        documents: data.documents,
        suggestedExperts: [],
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  createConversation: async (title) => {
    const { conversation } = await api<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    set((s) => ({ conversations: [conversation, ...s.conversations] }));
    return conversation;
  },

  updateConversation: async (id, data) => {
    const { conversation } = await api<{ conversation: Conversation }>(`/api/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    set({ currentConversation: conversation });
  },

  deleteConversation: async (id) => {
    await api(`/api/conversations/${id}`, { method: 'DELETE' });
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      currentConversation: null,
    }));
  },

  sendMessage: async (id, content) => {
    set((s) => ({
      isSending: true,
      messages: [...s.messages, {
        id: -Date.now(),
        conversation_id: id,
        expert_id: null,
        role: 'user' as const,
        content,
        created_at: new Date().toISOString(),
      }],
    }));
    try {
      const { messages: responseMessages, suggestedExperts } = await api<{
        messages: Message[];
        suggestedExperts: Expert[];
      }>(`/api/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      set((s) => ({
        messages: [
          ...s.messages.filter((m) => m.id > 0),
          ...responseMessages,
        ],
        suggestedExperts: suggestedExperts || [],
        isSending: false,
      }));
    } catch {
      // Remove optimistic user message on error, re-add without temp
      set((s) => ({
        messages: s.messages.filter((m) => m.id > 0),
        isSending: false,
      }));
    }
  },

  assignExpert: async (conversationId, expertId) => {
    const { experts } = await api<{ experts: (Expert & { assignment_id: number })[] }>(
      `/api/conversations/${conversationId}/experts`,
      { method: 'POST', body: JSON.stringify({ expert_id: expertId }) }
    );
    set({ experts, suggestedExperts: [] });
  },

  removeExpert: async (conversationId, expertId) => {
    const { experts } = await api<{ experts: (Expert & { assignment_id: number })[] }>(
      `/api/conversations/${conversationId}/experts/${expertId}`,
      { method: 'DELETE' }
    );
    set({ experts });
  },

  uploadDocument: async (conversationId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/conversations/${conversationId}/documents`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error);
    }
    const { document } = await res.json();
    set((s) => ({ documents: [document, ...s.documents] }));
  },

  deleteDocument: async (conversationId, docId) => {
    await api(`/api/conversations/${conversationId}/documents/${docId}`, { method: 'DELETE' });
    set((s) => ({ documents: s.documents.filter((d) => d.id !== docId) }));
  },
}));
