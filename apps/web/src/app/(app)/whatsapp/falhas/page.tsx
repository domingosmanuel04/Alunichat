'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Message } from '@/lib/api';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type FailedRow = Message & {
  conversation?: {
    id?: string;
    subject?: string | null;
    contact?: { name?: string | null; phone?: string | null };
    channel?: { name?: string | null };
  };
  failedReason?: string | null;
};

export default function WhatsAppFalhasPage() {
  const [items, setItems] = useState<FailedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listFailedMessages();
      setItems(rows as FailedRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar fila');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRetry(id: string) {
    setRetrying(id);
    try {
      await api.retryFailedMessage(id);
      toast.success('Mensagem reenviada');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao reenviar');
    } finally {
      setRetrying(null);
    }
  }

  return (
    <>
      <AppTopbar
        title="Fila de falhas"
        subtitle="Mensagens WhatsApp com falha de envio"
        actions={
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhuma mensagem falhada.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Conversa</th>
                  <th className="px-4 py-3">Mensagem</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-t border-surface-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">
                        {m.conversation?.contact?.name ||
                          m.conversation?.subject ||
                          '—'}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {m.conversation?.channel?.name ||
                          m.conversation?.contact?.phone ||
                          '—'}
                      </p>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-ink-muted">
                      {m.body || m.content || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="danger">{m.failedReason || m.status || 'FAILED'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-faint">
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleString('pt-PT')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        loading={retrying === m.id}
                        onClick={() => void onRetry(m.id)}
                      >
                        Reenviar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
