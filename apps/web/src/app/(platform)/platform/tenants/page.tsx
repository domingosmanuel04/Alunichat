'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/ApiListPage';
import { api, ApiError, type Tenant } from '@/lib/api';
import { setTenantSlug, setTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PlatformTenantsPage() {
  const router = useRouter();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<{ name?: string; displayName?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const [list, planList] = await Promise.all([
        api.platformTenants(),
        api.listBillingPlans().catch(() => []),
      ]);
      setTenants(list);
      setPlans(planList as { name?: string; displayName?: string }[]);
      setMissing(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(err instanceof Error ? err.message : 'Falha ao listar tenants');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function suspend(id: string) {
    setActing(id);
    try {
      await api.suspendTenant(id);
      toast.success('Empresa suspensa');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    } finally {
      setActing(null);
    }
  }

  async function reactivate(id: string) {
    setActing(id);
    try {
      await api.reactivateTenant(id);
      toast.success('Empresa reativada');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    } finally {
      setActing(null);
    }
  }

  async function changePlan(id: string) {
    const planName = planDraft[id];
    if (!planName) {
      toast.error('Selecione um plano');
      return;
    }
    setActing(id);
    try {
      await api.changeTenantPlan(id, planName);
      toast.success('Plano atualizado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao mudar plano');
    } finally {
      setActing(null);
    }
  }

  async function impersonate(id: string) {
    setActing(id);
    try {
      const res = await api.platformImpersonate(id);
      if (res.accessToken) {
        setTokens(res.accessToken, res.refreshToken);
        if (res.tenant?.slug) setTenantSlug(res.tenant.slug);
        await fetchMe();
        toast.success(
          res.message ||
            `A entrar como ${res.tenant?.name || res.tenant?.slug || 'tenant'}…`,
        );
        router.push('/dashboard');
        return;
      }
      const slug = res.tenant?.slug || '—';
      toast.success(
        res.message ||
          `Impersonação auditada · slug: ${slug}. ${res.accessHint || ''}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao impersonar');
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <AppTopbar
        title="Empresas"
        subtitle="Contas da plataforma"
        actions={
          <Link
            href="/platform/signups"
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-ink-muted hover:bg-white/5"
          >
            Ver aprovações
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : missing ? (
          <EmptyState
            title="Endpoint indisponível"
            description="GET /platform/tenants ainda não está disponível."
          />
        ) : error ? (
          <EmptyState title="Erro" description={error} />
        ) : tenants.length === 0 ? (
          <EmptyState title="Nenhuma empresa" description="A API não retornou tenants." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Criado</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{t.slug}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {typeof t.plan === 'string'
                        ? t.plan
                        : t.plan?.name || t.plan?.tier || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.status === 'ACTIVE' ? 'success' : 'default'}>
                        {t.status || '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-faint">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="h-8 rounded-md border border-surface-border bg-surface-overlay px-2 text-xs text-ink"
                          value={
                            planDraft[t.id] ||
                            (typeof t.plan === 'string'
                              ? t.plan
                              : t.plan?.name || '')
                          }
                          onChange={(e) =>
                            setPlanDraft((prev) => ({
                              ...prev,
                              [t.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Plano…</option>
                          {plans.map((p) => (
                            <option key={String(p.name)} value={String(p.name)}>
                              {p.displayName || p.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={acting === t.id}
                          onClick={() => void changePlan(t.id)}
                        >
                          Mudar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={acting === t.id}
                          onClick={() => void impersonate(t.id)}
                        >
                          Impersonar
                        </Button>
                        {t.status === 'ACTIVE' || t.status === 'TRIAL' ? (
                          <Button
                            size="sm"
                            variant="danger"
                            loading={acting === t.id}
                            onClick={() => void suspend(t.id)}
                          >
                            Suspender
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            loading={acting === t.id}
                            onClick={() => void reactivate(t.id)}
                          >
                            Reativar
                          </Button>
                        )}
                      </div>
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
