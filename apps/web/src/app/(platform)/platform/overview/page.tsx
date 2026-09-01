'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/ApiListPage';
import { api, ApiError, type PlatformOverview } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function normalizeOverview(raw: PlatformOverview) {
  return {
    tenantsTotal: raw.tenantsTotal ?? raw.tenants?.total,
    tenantsActive: raw.tenantsActive ?? raw.tenants?.active,
    usersTotal: raw.usersTotal,
    messagesToday: raw.messagesToday,
    messagesTotal: raw.messagesTotal,
    conversationsTotal: raw.conversationsTotal,
    pendingSignups: raw.tenants?.pendingSignups ?? 0,
    pendingPlanChanges: raw.tenants?.pendingPlanChanges ?? 0,
  };
}

type AlertsPayload = {
  pendingSignups?: unknown[];
  pendingPlanChanges?: unknown[];
  failedWebhooks24h?: number;
  disconnectedChannels?: Record<string, unknown>[];
  nearPlanLimit?: Record<string, unknown>[];
  generatedAt?: string;
};

export default function PlatformOverviewPage() {
  const [data, setData] = useState<ReturnType<typeof normalizeOverview> | null>(null);
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overview, alertsData] = await Promise.all([
          api.platformOverview(),
          api.platformListAlerts().catch(() => null),
        ]);
        if (!cancelled) {
          setData(normalizeOverview(overview));
          setAlerts(alertsData);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) setMissing(true);
          else setError(err instanceof Error ? err.message : 'Falha ao carregar overview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: 'Empresas', value: data?.tenantsTotal },
    { label: 'Ativas', value: data?.tenantsActive },
    { label: 'Utilizadores', value: data?.usersTotal },
    { label: 'Conversas', value: data?.conversationsTotal },
    { label: 'Mensagens', value: data?.messagesTotal ?? data?.messagesToday },
  ];

  const pendingSignups =
    alerts?.pendingSignups?.length ?? data?.pendingSignups ?? 0;
  const pendingPlanChanges =
    alerts?.pendingPlanChanges?.length ?? data?.pendingPlanChanges ?? 0;
  const failedWebhooks = alerts?.failedWebhooks24h ?? 0;
  const disconnected = alerts?.disconnectedChannels?.length ?? 0;
  const nearLimit = alerts?.nearPlanLimit?.length ?? 0;

  return (
    <>
      <AppTopbar title="Visão geral" subtitle="Administração da plataforma" />
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : missing ? (
          <EmptyState
            title="Endpoint indisponível"
            description="GET /platform/overview ainda não está disponível."
          />
        ) : error ? (
          <EmptyState title="Erro" description={error} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/platform/signups" className="block">
                <Card
                  className={
                    pendingSignups > 0
                      ? 'border-amber-500/40 bg-amber-500/10 transition hover:bg-amber-500/15'
                      : 'transition hover:bg-white/[0.03]'
                  }
                >
                  <CardDescription>Registos pendentes</CardDescription>
                  <CardTitle className="mt-2 text-2xl tabular-nums text-amber-200">
                    {pendingSignups.toLocaleString('pt-PT')}
                  </CardTitle>
                  <p className="mt-1 text-xs text-ink-faint">Ver aprovações →</p>
                </Card>
              </Link>
              <Link href="/platform/signups?tab=plan-changes" className="block">
                <Card
                  className={
                    pendingPlanChanges > 0
                      ? 'border-sky-500/40 bg-sky-500/10 transition hover:bg-sky-500/15'
                      : 'transition hover:bg-white/[0.03]'
                  }
                >
                  <CardDescription>Mudanças de plano</CardDescription>
                  <CardTitle className="mt-2 text-2xl tabular-nums text-sky-200">
                    {pendingPlanChanges.toLocaleString('pt-PT')}
                  </CardTitle>
                  <p className="mt-1 text-xs text-ink-faint">Ver pedidos →</p>
                </Card>
              </Link>
              <Card
                className={
                  failedWebhooks > 0 || disconnected > 0 || nearLimit > 0
                    ? 'border-red-500/30 bg-red-500/10'
                    : undefined
                }
              >
                <CardDescription>Alertas operacionais</CardDescription>
                <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                  <li>Webhooks falhados (24h): {failedWebhooks}</li>
                  <li>Canais desligados: {disconnected}</li>
                  <li>Perto do limite de plano: {nearLimit}</li>
                </ul>
                {alerts?.generatedAt ? (
                  <p className="mt-2 text-[10px] text-ink-faint">
                    {new Date(alerts.generatedAt).toLocaleString('pt-PT')}
                  </p>
                ) : null}
              </Card>
            </div>

            {disconnected > 0 || nearLimit > 0 ? (
              <div className="rounded-xl border border-surface-border p-4">
                <h3 className="text-sm font-semibold text-ink">Detalhe dos alertas</h3>
                {disconnected > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                    {(alerts?.disconnectedChannels || []).slice(0, 8).map((ch, i) => (
                      <li key={String(ch.id || i)}>
                        {String(ch.name || ch.id)} · {String(ch.status || '—')}
                        {ch.tenant && typeof ch.tenant === 'object'
                          ? ` · ${(ch.tenant as { slug?: string }).slug || ''}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {nearLimit > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-amber-200">
                    {(alerts?.nearPlanLimit || []).slice(0, 8).map((t, i) => (
                      <li key={String(t.tenantId || i)}>
                        {String(t.name || t.slug)} · canais {String(t.channelsUsed)}/
                        {String(t.channelsLimit)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {cards.map((c) => (
                <Card key={c.label}>
                  <CardDescription>{c.label}</CardDescription>
                  <CardTitle className="mt-2 text-2xl tabular-nums">
                    {c.value === undefined || c.value === null
                      ? '—'
                      : typeof c.value === 'number'
                        ? c.value.toLocaleString('pt-BR')
                        : String(c.value)}
                  </CardTitle>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
