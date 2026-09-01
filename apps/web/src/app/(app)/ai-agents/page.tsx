'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type AiAgent } from '@/lib/api';
import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AiAgentsPage() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await api.listAgents();
        if (!cancelled) {
          setAgents(list);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao listar agentes');
          setAgents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AppTopbar title="AI Agents" subtitle="Aluri e agentes especializados" />
      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhum agente de IA configurado nesta conta.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand-light">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{agent.name}</CardTitle>
                  {agent.status ? <Badge tone="brand">{agent.status}</Badge> : null}
                </div>
                <CardDescription className="mt-2 line-clamp-2">
                  {agent.description || agent.model || 'Sem descrição'}
                </CardDescription>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
