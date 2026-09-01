'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatThread } from '@/components/inbox/ChatThread';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { Button } from '@/components/ui/Button';
import { api, type Channel } from '@/lib/api';
import { useInboxStore } from '@/stores/inbox-store';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const QUEUES = [
  { id: 'aguardando', label: 'Aguardando' },
  { id: 'atendendo', label: 'Atendendo' },
  { id: 'finalizado', label: 'Finalizado' },
  { id: 'all', label: 'Todas' },
];

function WhatsAppChatInner() {
  const searchParams = useSearchParams();
  const channelIdParam = searchParams.get('channelId') || undefined;
  const loadConversations = useInboxStore((s) => s.loadConversations);
  const syncWhatsAppChats = useInboxStore((s) => s.syncWhatsAppChats);
  const queueFilter = useInboxStore((s) => s.queueFilter);
  const setQueueFilter = useInboxStore((s) => s.setQueueFilter);
  const error = useInboxStore((s) => s.error);
  const selectedId = useInboxStore((s) => s.selectedId);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<string | undefined>(channelIdParam);
  const [syncing, setSyncing] = useState(false);

  const loadChannels = useCallback(async () => {
    try {
      const list = await api.listChannels();
      const wa = list.filter((c) => (c.type || '').toUpperCase() === 'WHATSAPP');
      setChannels(wa);
      if (!channelId && wa.length) {
        const connected = wa.find((c) => (c.status || '').toUpperCase() === 'CONNECTED');
        setChannelId(connected?.id || wa[0].id);
      }
    } catch {
      setChannels([]);
    }
  }, [channelId]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (channelIdParam) setChannelId(channelIdParam);
  }, [channelIdParam]);

  useEffect(() => {
    setQueueFilter('aguardando');
  }, [setQueueFilter]);

  useEffect(() => {
    void loadConversations({
      channelId,
      channelType: channelId ? undefined : 'WHATSAPP',
      queue: queueFilter === 'all' ? undefined : queueFilter,
    });
  }, [loadConversations, queueFilter, channelId]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === channelId),
    [channels, channelId],
  );
  const connected =
    (activeChannel?.status || '').toUpperCase() === 'CONNECTED' ||
    channels.some((c) => (c.status || '').toUpperCase() === 'CONNECTED');

  async function onSync() {
    const id = channelId || channels.find((c) => (c.status || '').toUpperCase() === 'CONNECTED')?.id;
    if (!id) {
      toast.error('Selecione ou conecte uma instância WhatsApp');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncWhatsAppChats(id);
      toast.success(
        `Sincronizado: ${result.chats} conversas e ${result.groups} grupos`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppTopbar
        title="WhatsApp · Chat"
        subtitle={
          activeChannel
            ? `${activeChannel.name}${activeChannel.phoneNumber ? ` · ${activeChannel.phoneNumber}` : ''}`
            : 'Conversas e grupos da instância conectada'
        }
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-full max-w-sm shrink-0 flex-col border-r border-surface-border md:w-80">
          <div className="space-y-3 border-b border-surface-border p-3">
            <div className="flex gap-1 rounded-lg bg-surface p-1">
              {QUEUES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setQueueFilter(q.id);
                    void loadConversations({
                      channelId,
                      channelType: channelId ? undefined : 'WHATSAPP',
                      queue: q.id === 'all' ? undefined : q.id,
                    });
                  }}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition',
                    queueFilter === q.id
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {channels.length > 0 ? (
              <select
                value={channelId || ''}
                onChange={(e) => setChannelId(e.target.value || undefined)}
                className="h-9 w-full rounded-lg border border-surface-border bg-surface-raised px-2 text-xs text-ink"
              >
                <option value="">Todas as instâncias</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {(c.status || '').toUpperCase() === 'CONNECTED' ? ' · online' : ''}
                  </option>
                ))}
              </select>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              loading={syncing}
              onClick={() => void onSync()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {syncing
                ? 'A sincronizar (pode demorar ~1 min)…'
                : 'Sincronizar conversas e grupos'}
            </Button>
            <p className="text-[10px] leading-relaxed text-ink-faint">
              Puxa conversas 1:1, grupos e fotos de perfil. Se faltar histórico, desconecte e
              volte a ligar o QR nas Instâncias.
            </p>
          </div>

          <ConversationList whatsappStyle />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {error ? (
            <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
              {error}
            </div>
          ) : null}
          <ChatThread
            emptyHint={
              connected
                ? undefined
                : 'Conecte uma instância em WhatsApp → Instâncias e sincronize as conversas.'
            }
            enableSchedule
            showWhatsAppEmpty={!selectedId}
          />
        </div>

        <div className="hidden w-72 shrink-0 border-l border-surface-border xl:flex xl:flex-col">
          <ContactPanel />
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
          Carregando chat…
        </div>
      }
    >
      <WhatsAppChatInner />
    </Suspense>
  );
}
