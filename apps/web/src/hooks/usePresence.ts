'use client';

import { getAccessToken } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const DEFAULT_API_URL = 'http://localhost:4000';

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
}

export type PresenceUser = {
  userId: string;
  name: string;
  socketId?: string;
};

/**
 * Joins a conversation room and listens for presence:update.
 * Creates a lightweight socket connection scoped to this hook.
 */
export function usePresence(conversationId: string | null | undefined) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!conversationId) {
      setUsers([]);
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    let socket: Socket | null = io(`${apiBase()}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const onPresence = (payload: {
      conversationId?: string;
      users?: PresenceUser[];
    }) => {
      if (payload?.conversationId === conversationId) {
        setUsers(Array.isArray(payload.users) ? payload.users : []);
      }
    };

    socket.on('presence:update', onPresence);
    socket.emit('conversation:join', { conversationId });

    return () => {
      socket?.emit('conversation:leave', { conversationId });
      socket?.off('presence:update', onPresence);
      socket?.disconnect();
      socket = null;
      setUsers([]);
    };
  }, [conversationId]);

  return users;
}
