'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type FlagRow = {
  id?: string;
  key?: string;
  defaultEnabled?: boolean;
  description?: string | null;
  tenants?: {
    enabled?: boolean;
    tenant?: { id?: string; slug?: string; name?: string };
  }[];
};

export default function PlatformFeatureFlagsPage() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [tenants, setTenants] = useState<{ id: string; slug: string; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [defaultEnabled, setDefaultEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [tenantKey, setTenantKey] = useState('');
  const [tenantEnabled, setTenantEnabled] = useState(true);
  const [tenantSaving, setTenantSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, tenantList] = await Promise.all([
        api.platformFeatureFlags(),
        api.platformTenants().catch(() => []),
      ]);
      setFlags(list as FlagRow[]);
      setTenants(
        tenantList.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar flags');
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpsert(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    try {
      await api.platformUpsertFeatureFlag({
        key: key.trim(),
        defaultEnabled,
        description: description.trim() || undefined,
      });
      toast.success('Flag guardada');
      setKey('');
      setDescription('');
      setDefaultEnabled(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar flag');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFlag(flag: FlagRow) {
    if (!flag.key) return;
    try {
      await api.platformUpsertFeatureFlag({
        key: flag.key,
        defaultEnabled: !flag.defaultEnabled,
        description: flag.description || undefined,
      });
      toast.success(`Flag ${flag.key} atualizada`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alternar');
    }
  }

  async function onSetTenantFlag(e: FormEvent) {
    e.preventDefault();
    if (!tenantId || !tenantKey.trim()) {
      toast.error('Selecione empresa e flag');
      return;
    }
    setTenantSaving(true);
    try {
      await api.platformSetTenantFlag(tenantId, tenantKey.trim(), tenantEnabled);
      toast.success('Override por tenant guardado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no override');
    } finally {
      setTenantSaving(false);
    }
  }

  return (
    <>
      <AppTopbar title="Sinalizadores" subtitle="Feature flags globais e por empresa" />
      <div className="flex-1 space-y-6 overflow-auto p-5">
        <form
          onSubmit={onUpsert}
          className="grid gap-3 rounded-xl border border-surface-border p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Input
            label="Key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="nova_funcionalidade"
            required
          />
          <Input
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
          />
          <label className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={defaultEnabled}
              onChange={(e) => setDefaultEnabled(e.target.checked)}
            />
            Ativa por defeito
          </label>
          <div className="flex items-end">
            <Button type="submit" loading={saving} className="w-full">
              Criar / atualizar
            </Button>
          </div>
        </form>

        <form
          onSubmit={onSetTenantFlag}
          className="grid gap-3 rounded-xl border border-surface-border p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Empresa</label>
            <select
              className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-2 text-sm text-ink"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">Selecionar…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.slug} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Flag</label>
            <select
              className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-2 text-sm text-ink"
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
            >
              <option value="">Selecionar…</option>
              {flags.map((f) => (
                <option key={String(f.key)} value={String(f.key)}>
                  {f.key}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={tenantEnabled}
              onChange={(e) => setTenantEnabled(e.target.checked)}
            />
            Ativar para este tenant
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" loading={tenantSaving} className="w-full">
              Definir override
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : flags.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma feature flag.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Padrão</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Overrides</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={String(f.id || f.key)} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-mono text-xs text-ink">{f.key}</td>
                    <td className="px-4 py-3">
                      <Badge tone={f.defaultEnabled ? 'success' : 'default'}>
                        {f.defaultEnabled ? 'ON' : 'OFF'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{f.description || '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-faint">
                      {(f.tenants || []).length === 0
                        ? '—'
                        : (f.tenants || [])
                            .map(
                              (t) =>
                                `${t.tenant?.slug || '?'}:${t.enabled ? 'on' : 'off'}`,
                            )
                            .join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => void toggleFlag(f)}>
                        Alternar
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
