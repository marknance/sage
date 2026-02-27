import { create } from 'zustand';
import { api, streamApi } from '../lib/api';
import { toast } from './toastStore';
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
  extracted_text?: string | null;
  created_at: string;
}

interface ConversationState {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  currentConversation: Conversation | null;
  messages: Message[];
  hasMoreMessages: boolean;
  experts: (Expert & { assignment_id: number; backend_override_id?: number | null; conv_model_override?: string | null })[];
  documents: Document[];
  suggestedExperts: Expert[];
  isLoading: boolean;
  isSending: boolean;
  isStreaming: boolean;

  fetchConversations: (params?: { search?: string; sort?: string; type?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchOlderMessages: (conversationId: number, beforeId: number) => Promise<void>;
  fetchConversation: (id: number) => Promise<void>;
  createConversation: (title?: string, type?: string) => Promise<Conversation>;
  updateConversation: (id: number, data: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
  sendMessage: (id: number, content: string) => Promise<void>;
  sendMessageStream: (id: number, content: string) => Promise<void>;
  assignExpert: (conversationId: number, expertId: number) => Promise<void>;
  removeExpert: (conversationId: number, expertId: number) => Promise<void>;
  updateExpertOverride: (conversationId: number, expertId: number, data: { backend_override_id?: number | null; model_override?: string | null }) => Promise<void>;
  editMessage: (conversationId: number, messageId: number, content: string) => Promise<void>;
  deleteMessage: (conversationId: number, messageId: number) => Promise<void>;
  uploadDocument: (conversationId: number, file: File) => Promise<void>;
  deleteDocument: (conversationId: number, docId: number) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  total: 0,
  limit: 24,
  offset: 0,
  currentConversation: null,
  messages: [],
  hasMoreMessages: false,
  experts: [],
  documents: [],
  suggestedExperts: [],
  isLoading: false,
  isSending: false,
  isStreaming: false,

  fetchConversations: async (params) => {
    set({ isLoading: true });
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.sort) query.set('sort', params.sort);
      if (params?.type) query.set('type', params.type);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const qs = query.toString();
      const data = await api<{ conversations: Conversation[]; total: number; limit: number; offset: number }>(`/api/conversations${qs ? `?${qs}` : ''}`);
      set({ conversations: data.conversations, total: data.total, limit: data.limit, offset: data.offset, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || 'Failed to load conversations');
    }
  },

  fetchConversation: async (id) => {
    set({ isLoading: true });
    try {
      const data = await api<{
        conversation: Conversation;
        experts: (Expert & { assignment_id: number; backend_override_id?: number | null; conv_model_override?: string | null })[];
        messages: Message[];
        documents: Document[];
        hasMore: boolean;
      }>(`/api/conversations/${id}`);
      set({
        currentConversation: data.conversation,
        experts: data.experts,
        messages: data.messages,
        hasMoreMessages: data.hasMore,
        documents: data.documents,
        suggestedExperts: [],
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      toast.error(err.message || 'Failed to load conversation');
    }
  },

  createConversation: async (title, type) => {
    const { conversation } = await api<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, type }),
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
    toast.success('Conversation deleted');
  },

  fetchOlderMessages: async (conversationId, beforeId) => {
    try {
      const data = await api<{
        conversation: { id: number };
        messages: Message[];
        hasMore: boolean;
      }>(`/api/conversations/${conversationId}?before=${beforeId}&limit=50`);
      set((s) => ({
        messages: [...data.messages, ...s.messages],
        hasMoreMessages: data.hasMore,
      }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load older messages');
    }
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
    } catch (err: any) {
      set((s) => ({
        messages: s.messages.filter((m) => m.id > 0),
        isSending: false,
      }));
      toast.error(err.message || 'Failed to send message');
    }
  },

  sendMessageStream: async (id, content) => {
    const tempUserId = -Date.now();
    set((s) => ({
      isSending: true,
      isStreaming: false,
      messages: [...s.messages, {
        id: tempUserId,
        conversation_id: id,
        expert_id: null,
        role: 'user' as const,
        content,
        created_at: new Date().toISOString(),
      }],
    }));

    let currentPlaceholderId = -1;

    try {
      await streamApi(`/api/conversations/${id}/messages/stream`, { content }, (event, data) => {
        switch (event) {
          case 'user_message':
            // Replace optimistic user message with real one
            set((s) => ({
              messages: s.messages.map((m) => m.id === tempUserId ? data : m),
            }));
            break;
          case 'expert_start':
            currentPlaceholderId = -(Date.now() + data.message_index);
            set((s) => ({
              isStreaming: true,
              messages: [...s.messages, {
                id: currentPlaceholderId,
                conversation_id: id,
                expert_id: data.expert_id,
                role: 'assistant' as const,
                content: '',
                expert_name: data.expert_name,
                created_at: new Date().toISOString(),
              }],
            }));
            break;
          case 'token':
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === currentPlaceholderId
                  ? { ...m, content: m.content + data.content }
                  : m
              ),
            }));
            break;
          case 'expert_end':
            // Swap placeholder with saved message from server
            set((s) => ({
              messages: s.messages.map((m) => m.id === currentPlaceholderId ? data : m),
            }));
            break;
          case 'suggested_experts':
            set({ suggestedExperts: data.experts || [] });
            break;
          case 'error':
            console.error('Stream error:', data.message);
            break;
          case 'done':
            set({ isSending: false, isStreaming: false });
            break;
        }
      });
      // Ensure flags are cleared even if done event was missed
      set({ isSending: false, isStreaming: false });
    } catch (err: any) {
      set((s) => ({
        messages: s.messages.filter((m) => m.id > 0),
        isSending: false,
        isStreaming: false,
      }));
      toast.error(err.message || 'Failed to get AI response');
    }
  },

  updateExpertOverride: async (conversationId, expertId, data) => {
    const { experts } = await api<{ experts: (Expert & { assignment_id: number; backend_override_id?: number | null; conv_model_override?: string | null })[] }>(
      `/api/conversations/${conversationId}/experts/${expertId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    set({ experts });
  },

  assignExpert: async (conversationId, expertId) => {
    const { experts } = await api<{ experts: (Expert & { assignment_id: number; backend_override_id?: number | null; conv_model_override?: string | null })[] }>(
      `/api/conversations/${conversationId}/experts`,
      { method: 'POST', body: JSON.stringify({ expert_id: expertId }) }
    );
    set({ experts, suggestedExperts: [] });
  },

  removeExpert: async (conversationId, expertId) => {
    const { experts } = await api<{ experts: (Expert & { assignment_id: number; backend_override_id?: number | null; conv_model_override?: string | null })[] }>(
      `/api/conversations/${conversationId}/experts/${expertId}`,
      { method: 'DELETE' }
    );
    set({ experts });
  },

  editMessage: async (conversationId, messageId, content) => {
    const { message } = await api<{ message: Message }>(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    set((s) => ({ messages: s.messages.map((m) => m.id === messageId ? message : m) }));
  },

  deleteMessage: async (conversationId, messageId) => {
    await api(`/api/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' });
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
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
