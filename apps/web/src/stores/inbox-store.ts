'use client';

import { create } from 'zustand';
import {
  api,
  type Conversation,
  type ConversationDetail,
  type Message,
} from '@/lib/api';

type InboxState = {
  conversations: Conversation[];
  selectedId: string | null;
  detail: ConversationDetail | null;
  loadingList: boolean;
  loadingDetail: boolean;
  sending: boolean;
  error: string | null;
  queueFilter: string;
  channelId?: string;
  channelType?: string;
  searchQuery?: string;
  loadConversations: (params?: {
    status?: string;
    queue?: string;
    channelType?: string;
    channelId?: string;
    search?: string;
  }) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  clearSelection: () => void;
  sendMessage: (
    content: string,
    opts?: { scheduledAt?: string; isPrivate?: boolean },
  ) => Promise<void>;
  setQueueFilter: (queue: string) => void;
  syncWhatsAppChats: (channelId: string) => Promise<{ total: number }>;
};

export const useInboxStore = create<InboxState>((set, get) => ({
  conversations: [],
  selectedId: null,
  detail: null,
  loadingList: false,
  loadingDetail: false,
  sending: false,
  error: null,
  queueFilter: 'all',
  channelId: undefined,
  channelType: undefined,
  searchQuery: undefined,

  setQueueFilter(queue) {
    set({ queueFilter: queue });
  },

  clearSelection() {
    set({ selectedId: null, detail: null });
  },

  async loadConversations(params) {
    set({ loadingList: true, error: null });
    try {
      const channelId = params?.channelId ?? get().channelId;
      const channelType = params?.channelType ?? get().channelType;
      const queue =
        params?.queue ??
        (get().queueFilter === 'all' ? undefined : get().queueFilter);
      const search =
        params?.search !== undefined ? params.search : get().searchQuery;
      const conversations = await api.listConversations({
        status: params?.status,
        queue,
        search: search || undefined,
        channelType,
        channelId,
        pageSize: 100,
      });
      set({
        conversations,
        loadingList: false,
        channelId,
        channelType,
        searchQuery: search || undefined,
      });
    } catch (err) {
      set({
        loadingList: false,
        error: err instanceof Error ? err.message : 'Failed to load conversations',
        conversations: [],
      });
    }
  },

  async selectConversation(id) {
    set({ selectedId: id, loadingDetail: true, error: null });
    try {
      const detail = await api.getConversation(id);
      set({ detail, loadingDetail: false });
    } catch (err) {
      set({
        loadingDetail: false,
        detail: null,
        error: err instanceof Error ? err.message : 'Failed to load conversation',
      });
    }
  },

  async sendMessage(content, opts) {
    const { selectedId, detail } = get();
    if (!selectedId || !content.trim()) return;
    set({ sending: true, error: null });
    try {
      const message = await api.sendMessage(selectedId, {
        content: content.trim(),
        type: 'TEXT',
        scheduledAt: opts?.scheduledAt,
        isPrivate: opts?.isPrivate,
      });
      const messages: Message[] = [...(detail?.messages ?? []), message];
      set({
        detail: detail ? { ...detail, messages } : detail,
        sending: false,
      });
      await get().loadConversations();
    } catch (err) {
      set({
        sending: false,
        error: err instanceof Error ? err.message : 'Failed to send message',
      });
      throw err;
    }
  },

  async syncWhatsAppChats(channelId) {
    const result = await api.syncChannelChats(channelId);
    await get().loadConversations({
      channelId,
      channelType: undefined,
      queue: 'all',
    });
    set({ queueFilter: 'all' });
    return result;
  },
}));
