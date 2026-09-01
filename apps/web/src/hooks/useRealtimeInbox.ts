'use client';

import { getAccessToken } from '@/lib/auth';
import { notifyIncomingMessage } from '@/lib/notification-prefs';
import { useInboxStore } from '@/stores/inbox-store';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const DEFAULT_API_URL = 'http://localhost:4000';

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
}

let socket: Socket | null = null;

export function useRealtimeInbox() {
  const loadConversations = useInboxStore((s) => s.loadConversations);
  const selectedId = useInboxStore((s) => s.selectedId);
  const selectConversation = useInboxStore((s) => s.selectConversation);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    socket = io(`${apiBase()}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:message', (payload: { body?: string; conversationId?: string }) => {
      notifyIncomingMessage({
        title: 'Nova mensagem',
        body: payload?.body || 'Mensagem recebida no WhatsApp',
      });
      void loadConversations();
    });

    socket.on('conversation:updated', () => {
      void loadConversations();
    });

    socket.on('message:new', () => {
      const id = useInboxStore.getState().selectedId;
      if (id) void selectConversation(id);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [loadConversations, selectConversation]);

  useEffect(() => {
    if (!socket || !selectedId) return;
    socket.emit('conversation:join', { conversationId: selectedId });
    return () => {
      socket?.emit('conversation:leave', { conversationId: selectedId });
    };
  }, [selectedId]);
}
