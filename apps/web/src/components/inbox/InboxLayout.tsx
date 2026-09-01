'use client';

import { useInboxStore } from '@/stores/inbox-store';
import { useEffect } from 'react';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { ContactPanel } from './ContactPanel';
import { cn } from '@/lib/utils';

const QUEUES = [
  { id: 'all', label: 'Todas' },
  { id: 'unassigned', label: 'Não atribuídas' },
  { id: 'mine', label: 'Minhas' },
  { id: 'atendendo', label: 'Atendendo' },
  { id: 'finalizado', label: 'Finalizado' },
];

export function InboxLayout() {
  const loadConversations = useInboxStore((s) => s.loadConversations);
  const queueFilter = useInboxStore((s) => s.queueFilter);
  const setQueueFilter = useInboxStore((s) => s.setQueueFilter);
  const selectedId = useInboxStore((s) => s.selectedId);
  const error = useInboxStore((s) => s.error);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, queueFilter]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden">
      {/* Queues */}
      <div className="hidden w-44 shrink-0 flex-col border-r border-surface-border bg-surface/40 lg:flex">
        <div className="border-b border-surface-border px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Filas</p>
        </div>
        <ul className="space-y-0.5 p-2">
          {QUEUES.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => {
                  setQueueFilter(q.id);
                  void loadConversations({ queue: q.id === 'all' ? undefined : q.id });
                }}
                className={cn(
                  'w-full rounded-lg px-2.5 py-2 text-left text-sm transition',
                  queueFilter === q.id
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                {q.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Conversations — full width on mobile when nothing selected */}
      <div
        className={cn(
          'flex w-full max-w-sm shrink-0 flex-col border-r border-surface-border md:w-80',
          selectedId ? 'hidden md:flex' : 'flex',
          !selectedId && 'max-w-none md:max-w-sm',
        )}
      >
        <ConversationList />
      </div>

      {/* Thread — full width on mobile when selected */}
      <div
        className={cn(
          'min-w-0 flex-1 flex-col',
          selectedId ? 'flex' : 'hidden md:flex',
        )}
      >
        {error ? (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}
        <ChatThread showBackOnMobile />
      </div>

      {/* Contact panel — desktop only */}
      <div className="hidden w-72 shrink-0 border-l border-surface-border xl:flex xl:flex-col">
        <ContactPanel />
      </div>
    </div>
  );
}
