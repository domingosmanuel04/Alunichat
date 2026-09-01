'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, Channel } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

type Delivery = {
  id: string;
  event?: string;
  status?: string;
  attempts?: number;
  responseCode?: number | null;
  responseBody?: string | null;
  createdAt?: string;
  deliveredAt?: string | null;
  webhook?: {
    id?: string;
    url?: string;
    headers?: Record<string, string> | null;
  };
  [key: string]: unknown;
};

type WebhookItem = {
  id: string;
  url?: string;
  headers?: Record<string, string> | null;
};

function channelIdOf(d: Delivery, webhooks: WebhookItem[]): string | null {
  const fromNested = d.webhook?.headers?.channelId;
  if (fromNested) return fromNested;
  const hook = webhooks.find((w) => w.id === d.webhook?.id);
  return hook?.headers?.channelId || null;
}

function typeLabel(event?: string): string {
  if (!event) return '—';
  if (event === 'inbox') return 'inbox';
  if (event === 'webhook.test') return 'teste';
  return 'envio';
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  if (status === 'SUCCESS' || status === 'DELIVERED') return 'ok';
  if (status === 'FAILED' || status === 'ERROR') return 'erro';
  if (status === 'PENDING') return 'pendente';
  return status.toLowerCase();
}

export default function WebhookLogsPage() {
  const [items, setItems] = useState<Delivery[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const channelName = useCallback(
    (channelId: string | null) => {
      if (!channelId) return 'Empresa';
      const ch = channels.find((c) => c.id === channelId);
      return ch?.name || channelId.slice(0, 8);
    },
    [channels],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, chs, hooks] = await Promise.all([
        api.listWebhookDeliveries(),
        api.listChannels(),
        api.listWebhooks(),
      ]);
      setItems(list as Delivery[]);
      setChannels(chs);
      setWebhooks(hooks as WebhookItem[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar logs');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((d) => {
      const cid = channelIdOf(d, webhooks);
      if (channelFilter && cid !== channelFilter) return false;
      if (typeFilter === 'inbox' && d.event !== 'inbox') return false;
      if (typeFilter === 'envio' && (d.event === 'inbox' || !d.event)) return false;
      if (typeFilter === 'teste' && d.event !== 'webhook.test') return false;
      return true;
    });
  }, [items, webhooks, channelFilter, typeFilter]);

  return (
    <>
      <AppTopbar
        title="Logs de Webhook"
        subtitle="Histórico de envios e recebimentos (inbox) de webhooks da sua empresa."
      />

      <div className="flex-1 overflow-auto p-5 md:p-8">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 sm:flex-none sm:w-56">
            <Select
              label="Instância"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="">Todas da empresa</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px] flex-1 sm:flex-none sm:w-44">
            <Select
              label="Tipo"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="envio">Envio</option>
              <option value="inbox">Inbox</option>
              <option value="teste">Teste</option>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load()}
            className="mb-0.5"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Instância</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Erro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-sm text-ink-muted"
                    >
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => {
                    const cid = channelIdOf(d, webhooks);
                    const failed =
                      d.status === 'FAILED' || d.status === 'ERROR';
                    const errorText = failed
                      ? d.responseBody ||
                        (d.responseCode ? `HTTP ${d.responseCode}` : '—')
                      : '—';
                    return (
                      <tr
                        key={d.id}
                        className="border-t border-surface-border"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-ink-faint">
                          {d.createdAt
                            ? new Date(d.createdAt).toLocaleString('pt-PT')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-ink">
                          {channelName(cid)}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {typeLabel(d.event)}
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-ink-muted">
                          {d.event === 'inbox'
                            ? `inbox/${d.webhook?.id || '—'}`
                            : d.webhook?.url || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              d.status === 'DELIVERED' ||
                              d.status === 'SUCCESS'
                                ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300'
                                : failed
                                  ? 'rounded-md bg-red-500/15 px-2 py-0.5 text-xs text-red-300'
                                  : 'rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200'
                            }
                          >
                            {statusLabel(d.status)}
                          </span>
                        </td>
                        <td
                          className="max-w-[200px] truncate px-4 py-3 text-xs text-ink-muted"
                          title={errorText !== '—' ? errorText : undefined}
                        >
                          {errorText}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
