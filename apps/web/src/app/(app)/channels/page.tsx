'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Channel } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChannels(await api.listChannels());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar canais');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectMock() {
    setConnecting(true);
    try {
      await api.connectMockChannel({ name: `Mock ${new Date().toLocaleTimeString('pt-BR')}` });
      toast.success('Canal mock conectado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao conectar mock');
    } finally {
      setConnecting(false);
    }
  }

  function statusTone(status?: string) {
    const s = (status || '').toUpperCase();
    if (s === 'CONNECTED') return 'success' as const;
    if (s === 'ERROR' || s === 'DISCONNECTED') return 'danger' as const;
    if (s === 'CONNECTING' || s === 'DEGRADED') return 'warning' as const;
    return 'default' as const;
  }

  return (
    <>
      <AppTopbar title="Channels" subtitle="WhatsApp, Instagram, Webchat…" />
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
        <p className="text-sm text-ink-muted">{channels.length} canais</p>
        <Button size="sm" loading={connecting} onClick={() => void connectMock()}>
          Conectar mock
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhum canal. Use &quot;Conectar mock&quot; para testar a integração.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((ch) => (
              <Card key={ch.id}>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{ch.name}</CardTitle>
                  <Badge tone={statusTone(ch.status)}>{ch.status || '—'}</Badge>
                </div>
                <CardDescription className="mt-2">
                  {ch.type || '—'} · {ch.provider || '—'}
                </CardDescription>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
