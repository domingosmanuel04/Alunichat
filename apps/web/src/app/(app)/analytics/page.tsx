'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/ApiListPage';
import { api, type DashboardMetrics, ApiError } from '@/lib/api';
import { useEffect, useState } from 'react';

const METRIC_LABELS: Record<string, string> = {
  openConversations: 'Conversas abertas',
  pendingConversations: 'Conversas pendentes',
  newContacts: 'Novos contactos',
  openDeals: 'Negócios abertos',
  wonDealsValue: 'Valor ganhos',
  wonDeals: 'Negócios ganhos',
  ticketsOpen: 'Tickets abertos',
  messagesToday: 'Mensagens hoje',
  messagesWeek: 'Mensagens (semana)',
  aiHandledPercent: '% tratadas por IA',
  contacts: 'Contactos',
  'conversations.total': 'Conversas (total)',
  'conversations.open': 'Conversas (abertas)',
  'deals.open': 'Negócios (abertos)',
  'deals.won': 'Negócios (ganhos)',
};

function flattenMetrics(data: DashboardMetrics): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (
      key === 'greeting' ||
      key === 'insight' ||
      key === 'generatedAt' ||
      key === 'volumeByChannel' ||
      key === 'avgFirstResponseMinutes' ||
      key === 'leadsByTemperature'
    ) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [sub, subVal] of Object.entries(value as Record<string, unknown>)) {
        rows.push({
          key: `${key}.${sub}`,
          value: subVal === null || subVal === undefined ? '—' : String(subVal),
        });
      }
    } else {
      rows.push({
        key,
        value: value === null || value === undefined ? '—' : String(value),
      });
    }
  }
  return rows;
}

function labelFor(key: string) {
  return METRIC_LABELS[key] || key;
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<{ key: string; value: string }[]>([]);
  const [volumeByChannel, setVolumeByChannel] = useState<
    NonNullable<DashboardMetrics['volumeByChannel']>
  >([]);
  const [avgFirstResponseMinutes, setAvgFirstResponseMinutes] = useState<
    number | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dash = await api.getDashboard();
        if (!cancelled) {
          setRows(flattenMetrics(dash));
          setVolumeByChannel(Array.isArray(dash.volumeByChannel) ? dash.volumeByChannel : []);
          setAvgFirstResponseMinutes(
            typeof dash.avgFirstResponseMinutes === 'number'
              ? dash.avgFirstResponseMinutes
              : null,
          );
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Falha ao carregar análises');
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
      <AppTopbar title="Análises" subtitle="Métricas da operação" />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Erro" description={error} />
        ) : rows.length === 0 && volumeByChannel.length === 0 ? (
          <EmptyState title="Sem métricas" description="Ainda não há dados para mostrar." />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardDescription>Tempo médio 1.ª resposta</CardDescription>
                <CardTitle className="mt-2 text-xl tabular-nums">
                  {avgFirstResponseMinutes == null
                    ? '—'
                    : `${avgFirstResponseMinutes.toFixed(1)} min`}
                </CardTitle>
              </Card>
              {rows.map((r) => (
                <Card key={r.key}>
                  <CardDescription>{labelFor(r.key)}</CardDescription>
                  <CardTitle className="mt-2 text-xl tabular-nums">{r.value}</CardTitle>
                </Card>
              ))}
            </div>

            {volumeByChannel.length > 0 ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
                  Volume por canal
                </h2>
                <div className="overflow-hidden rounded-xl border border-surface-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                      <tr>
                        <th className="px-4 py-3">Canal</th>
                        <th className="px-4 py-3">Número</th>
                        <th className="px-4 py-3">Mensagens (semana)</th>
                        <th className="px-4 py-3">Conversas</th>
                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {volumeByChannel.map((ch) => (
                        <tr
                          key={ch.channelId || ch.name}
                          className="border-t border-surface-border"
                        >
                          <td className="px-4 py-3 text-ink">{ch.name || '—'}</td>
                          <td className="px-4 py-3 text-ink-muted">
                            {ch.phoneNumber || '—'}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink">
                            {(ch.messagesWeek ?? 0).toLocaleString('pt-PT')}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink">
                            {(ch.conversations ?? 0).toLocaleString('pt-PT')}
                          </td>
                          <td className="px-4 py-3 text-ink-muted">{ch.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
