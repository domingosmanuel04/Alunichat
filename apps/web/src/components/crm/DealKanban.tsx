'use client';

import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Deal, type Pipeline, type PipelineStage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export function DealKanban() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pipes = await api.listPipelines();
      setPipelines(pipes);
      const pid = pipelineId || pipes[0]?.id || '';
      if (pid && pid !== pipelineId) setPipelineId(pid);
      const dealList = await api.listDeals(pid ? { pipelineId: pid } : undefined);
      setDeals(dealList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar kanban');
      setPipelines([]);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stages: PipelineStage[] = useMemo(() => {
    const pipe = pipelines.find((p) => p.id === pipelineId) || pipelines[0];
    const list = pipe?.stages ?? [];
    return [...list].sort(
      (a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0),
    );
  }, [pipelines, pipelineId]);

  function dealsForStage(stageId: string) {
    return deals.filter((d) => d.stageId === stageId);
  }

  function onDragStart(e: DragEvent, dealId: string) {
    setDraggingId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function onDrop(e: DragEvent, stageId: string) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === stageId) return;

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId } : d)));
    try {
      await api.moveDeal(dealId, stageId);
      toast.success('Negócio movido');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao mover');
      void load();
    }
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-200">
        {error}
        <p className="mt-2 text-ink-muted">Verifique se a API expõe /crm/pipelines e /crm/deals.</p>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="m-5 rounded-xl border border-surface-border bg-surface-raised/60 p-8 text-center text-sm text-ink-muted">
        Nenhum pipeline/estágio encontrado. Crie um pipeline na API para usar o Kanban.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {pipelines.length > 1 ? (
        <div className="flex gap-2 border-b border-surface-border px-5 py-3">
          {pipelines.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPipelineId(p.id)}
              className={
                p.id === pipelineId
                  ? 'rounded-lg bg-brand/15 px-3 py-1.5 text-sm text-brand-light'
                  : 'rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-white/5'
              }
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-1 gap-3 overflow-x-auto p-5">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-surface-border bg-surface/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => void onDrop(e, stage.id)}
          >
            <div className="flex items-center justify-between border-b border-surface-border px-3 py-2.5">
              <p className="text-sm font-medium text-ink">{stage.name}</p>
              <Badge>{dealsForStage(stage.id).length}</Badge>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {dealsForStage(stage.id).map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, deal.id)}
                  className="cursor-grab rounded-lg border border-surface-border bg-surface-raised p-3 active:cursor-grabbing"
                >
                  <p className="text-sm font-medium text-ink">{deal.title}</p>
                  {typeof deal.value === 'number' ? (
                    <p className="mt-1 text-xs text-brand-light">
                      {formatCurrency(deal.value, deal.currency || 'BRL')}
                    </p>
                  ) : null}
                  {deal.contact?.name ? (
                    <p className="mt-1 text-xs text-ink-faint">{deal.contact.name}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
