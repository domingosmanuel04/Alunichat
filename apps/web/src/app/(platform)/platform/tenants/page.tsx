'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/ApiListPage';
import { api, ApiError, type Tenant } from '@/lib/api';
import { setTenantSlug, setTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function PlatformTenantsPage() {
  const router = useRouter();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await api.platformTenants();
      setTenants(list);
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

  async function createTenant() {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      toast.error('Informe nome e slug da empresa');
      return;
    }
    if (!createForm.ownerEmail.trim() || createForm.ownerPassword.trim().length < 8) {
      toast.error('Informe e-mail e senha do owner (mín. 8 caracteres)');
      return;
    }
    setCreating(true);
    try {
      await api.createPlatformTenant({
        name: createForm.name.trim(),
        slug: createForm.slug.trim(),
        planName: 'PRO',
        ownerName: createForm.ownerName.trim() || createForm.ownerEmail.trim(),
        ownerEmail: createForm.ownerEmail.trim(),
        ownerPassword: createForm.ownerPassword.trim(),
      });
      toast.success('Empresa e owner criados — já pode entrar no painel');
      setShowCreate(false);
      setCreateForm({
        name: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
      });
      setSlugTouched(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao criar empresa');
    } finally {
      setCreating(false);
    }
  }

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
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Fechar' : 'Criar owner'}
            </Button>
            <Link
              href="/platform/signups"
              className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-ink-muted hover:bg-white/5"
            >
              Ver aprovações
            </Link>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-5">
        {showCreate ? (
          <div className="mb-5 rounded-xl border border-surface-border bg-surface-raised/40 p-4">
            <h3 className="font-display text-base font-semibold text-ink">
              Criar empresa com acesso owner
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              O Super Admin define a senha. O owner pode entrar no painel de imediato.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                label="Nome da empresa"
                value={createForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setCreateForm((f) => ({
                    ...f,
                    name,
                    slug: slugTouched ? f.slug : slugify(name),
                  }));
                }}
                placeholder="Empresa XYZ"
              />
              <Input
                label="Slug"
                value={createForm.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setCreateForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                }}
                placeholder="empresa-xyz"
              />
              <Input
                label="Nome do owner"
                value={createForm.ownerName}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerName: e.target.value }))
                }
                placeholder="Nome completo"
              />
              <Input
                label="E-mail do owner"
                type="email"
                value={createForm.ownerEmail}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerEmail: e.target.value }))
                }
                placeholder="owner@empresa.com"
              />
              <Input
                label="Senha do owner"
                type="text"
                value={createForm.ownerPassword}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerPassword: e.target.value }))
                }
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="mt-4">
              <Button loading={creating} onClick={() => void createTenant()}>
                Criar empresa e owner
              </Button>
            </div>
          </div>
        ) : null}

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
