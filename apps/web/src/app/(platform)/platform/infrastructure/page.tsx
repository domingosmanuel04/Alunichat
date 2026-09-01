'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { HardDrive } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function PlatformInfrastructurePage() {
  const [backingUp, setBackingUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.platformHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar saúde');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBackup() {
    setBackingUp(true);
    try {
      const res = await api.platformBackup();
      toast.success(
        typeof res?.message === 'string'
          ? res.message
          : typeof res?.path === 'string'
            ? `Backup criado: ${res.path}`
            : 'Backup iniciado',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no backup');
    } finally {
      setBackingUp(false);
    }
  }

  const services = Array.isArray(health?.services)
    ? (health.services as Record<string, unknown>[])
    : null;

  const checks =
    health?.checks && typeof health.checks === 'object'
      ? (health.checks as Record<string, unknown>)
      : null;
  const db = checks?.database ?? health?.database;
  const redis = checks?.redis ?? health?.redis;

  return (
    <>
      <AppTopbar
        title="Infraestrutura"
        subtitle="Saúde da infra e backups"
        actions={
          <Button size="sm" loading={backingUp} onClick={() => void onBackup()}>
            <HardDrive className="h-3.5 w-3.5" />
            Backup
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardDescription>Database</CardDescription>
                <CardTitle className="mt-2 text-lg">
                  {db === true || db === 'ok' || db === 'OK'
                    ? 'OK'
                    : db === false
                      ? 'DOWN'
                      : String(db ?? '—')}
                </CardTitle>
              </Card>
              <Card>
                <CardDescription>Redis</CardDescription>
                <CardTitle className="mt-2 text-lg">
                  {redis === true || redis === 'ok' || redis === 'OK'
                    ? 'OK'
                    : redis === false
                      ? 'DOWN'
                      : String(redis ?? '—')}
                </CardTitle>
              </Card>
              <Card>
                <CardDescription>Backup</CardDescription>
                <CardTitle className="mt-2 text-sm font-normal text-ink-muted">
                  Use o botão Backup para disparar pg_dump / fallback JSON.
                </CardTitle>
              </Card>
            </div>

            {services && services.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-surface-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase text-ink-faint">
                    <tr>
                      <th className="px-4 py-3">Serviço</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Latência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s, i) => (
                      <tr key={i} className="border-t border-surface-border">
                        <td className="px-4 py-3 text-ink">
                          {String(s.service || s.name || '—')}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {String(s.status || '—')}
                        </td>
                        <td className="px-4 py-3 text-ink-faint">
                          {s.latencyMs != null ? `${String(s.latencyMs)} ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
