'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Rocket } from 'lucide-react';

type Campaign = {
  id: string;
  name?: string;
  status?: string;
  channel?: string;
  scheduledAt?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listCampaigns();
      setItems(list as Campaign[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar campanhas');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onLaunch(id: string) {
    setLaunching(id);
    try {
      await api.launchCampaign(id);
      toast.success('Campanha lançada');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao lançar');
    } finally {
      setLaunching(null);
    }
  }

  return (
    <>
      <AppTopbar
        title="Campanhas"
        subtitle="Broadcast e campanhas de marketing"
      />
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhuma campanha encontrada.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Criada</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-medium text-ink">
                      {c.name || 'Campanha'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{c.status || '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-faint">
                      {c.createdAt
                        ? new Date(String(c.createdAt)).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        loading={launching === c.id}
                        onClick={() => void onLaunch(c.id)}
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        Lançar
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
