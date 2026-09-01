'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/ApiListPage';
import { api, ApiError } from '@/lib/api';
import { Check, ExternalLink, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PendingSignup = {
  id: string;
  name?: string;
  slug?: string;
  createdAt?: string;
  plan?: { name?: string; displayName?: string; priceMonthly?: number | string };
  owner?: { name?: string; email?: string };
  signup?: {
    planName?: string;
    phone?: string | null;
    submittedAt?: string;
    paymentProofUrl?: string | null;
    paymentProofName?: string | null;
  };
};

type PendingPlanChange = {
  id: string;
  name?: string;
  slug?: string;
  plan?: { name?: string; displayName?: string };
  owner?: { name?: string; email?: string };
  planChange?: {
    status?: string;
    requestedPlanName?: string;
    currentPlanName?: string;
    paymentProofUrl?: string | null;
    paymentProofName?: string | null;
    submittedAt?: string;
  };
};

type Tab = 'signups' | 'plan-changes';

function PlatformSignupsContent() {
  const searchParams = useSearchParams();
  const initialTab: Tab =
    searchParams.get('tab') === 'plan-changes' ? 'plan-changes' : 'signups';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState<PendingSignup[]>([]);
  const [planChanges, setPlanChanges] = useState<PendingPlanChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [signups, changes] = await Promise.all([
        api.platformPendingSignups() as Promise<PendingSignup[]>,
        api.platformPendingPlanChanges() as Promise<PendingPlanChange[]>,
      ]);
      setItems(signups);
      setPlanChanges(changes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar pedidos');
      setItems([]);
      setPlanChanges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTab(searchParams.get('tab') === 'plan-changes' ? 'plan-changes' : 'signups');
  }, [searchParams]);

  async function approve(id: string) {
    setActing(id);
    try {
      await api.approveSignup(id);
      toast.success('Conta aprovada — o utilizador já pode entrar');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao aprovar');
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Motivo da rejeição (opcional):') || undefined;
    setActing(id);
    try {
      await api.rejectSignup(id, reason);
      toast.success('Pedido rejeitado');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao rejeitar');
    } finally {
      setActing(null);
    }
  }

  async function approveChange(id: string) {
    setActing(id);
    try {
      await api.approvePlanChange(id);
      toast.success('Mudança de plano aprovada');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao aprovar');
    } finally {
      setActing(null);
    }
  }

  async function rejectChange(id: string) {
    const reason = window.prompt('Motivo da rejeição (opcional):') || undefined;
    setActing(id);
    try {
      await api.rejectPlanChange(id, reason);
      toast.success('Mudança de plano rejeitada');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao rejeitar');
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <AppTopbar
        title="Aprovações"
        subtitle="Registos e mudanças de plano com comprovativo"
      />
      <div className="flex-1 overflow-auto p-5">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('signups')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition',
              tab === 'signups'
                ? 'bg-brand/15 text-brand-light'
                : 'text-ink-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            Registos
            {items.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-200">
                {items.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('plan-changes')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition',
              tab === 'plan-changes'
                ? 'bg-brand/15 text-brand-light'
                : 'text-ink-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            Mudanças de plano
            {planChanges.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-sky-500/20 px-1.5 text-xs text-sky-200">
                {planChanges.length}
              </span>
            ) : null}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : tab === 'signups' ? (
          items.length === 0 ? (
            <EmptyState
              title="Sem pedidos pendentes"
              description="Quando alguém criar conta e enviar comprovativo, aparece aqui."
            />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const proofUrl = api.mediaUrl(item.signup?.paymentProofUrl || '');
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-surface-border bg-surface-raised/40 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-ink">{item.name}</h3>
                          <Badge>{item.slug}</Badge>
                          <Badge tone="default">
                            {item.plan?.displayName ||
                              item.signup?.planName ||
                              '—'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-ink-muted">
                          {item.owner?.name || '—'} · {item.owner?.email || '—'}
                          {item.signup?.phone ? ` · ${item.signup.phone}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-ink-faint">
                          Enviado em{' '}
                          {item.signup?.submittedAt || item.createdAt
                            ? new Date(
                                String(item.signup?.submittedAt || item.createdAt),
                              ).toLocaleString('pt-PT')
                            : '—'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {proofUrl ? (
                          <a
                            href={proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-border px-3 text-sm text-ink-muted hover:bg-white/5 hover:text-ink"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver comprovativo
                          </a>
                        ) : null}
                        <Button
                          size="sm"
                          loading={acting === item.id}
                          onClick={() => void approve(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-500"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={acting === item.id}
                          onClick={() => void reject(item.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Recusar
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : planChanges.length === 0 ? (
          <EmptyState
            title="Sem mudanças pendentes"
            description="Pedidos de mudança de plano com comprovativo aparecem aqui."
          />
        ) : (
          <ul className="space-y-3">
            {planChanges.map((item) => {
              const proofUrl = api.mediaUrl(item.planChange?.paymentProofUrl || '');
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-surface-border bg-surface-raised/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-ink">{item.name}</h3>
                        <Badge>{item.slug}</Badge>
                        <Badge tone="default">
                          {item.planChange?.currentPlanName ||
                            item.plan?.displayName ||
                            item.plan?.name ||
                            '—'}
                          {' → '}
                          {item.planChange?.requestedPlanName || '—'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {item.owner?.name || '—'} · {item.owner?.email || '—'}
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        Enviado em{' '}
                        {item.planChange?.submittedAt
                          ? new Date(item.planChange.submittedAt).toLocaleString('pt-PT')
                          : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {proofUrl ? (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-border px-3 text-sm text-ink-muted hover:bg-white/5 hover:text-ink"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver comprovativo
                        </a>
                      ) : null}
                      <Button
                        size="sm"
                        loading={acting === item.id}
                        onClick={() => void approveChange(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={acting === item.id}
                        onClick={() => void rejectChange(item.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Recusar
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

export default function PlatformSignupsPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppTopbar title="Aprovações" subtitle="A carregar…" />
          <div className="flex-1 space-y-2 overflow-auto p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </>
      }
    >
      <PlatformSignupsContent />
    </Suspense>
  );
}
