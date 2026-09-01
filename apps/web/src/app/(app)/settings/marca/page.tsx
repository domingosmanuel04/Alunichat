'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function SettingsMarcaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [customDomain, setCustomDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [hideBranding, setHideBranding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wl = await api.getWhiteLabel();
      setAppName(wl.appName || '');
      setPrimaryColor(wl.primaryColor || '#10b981');
      setCustomDomain(wl.customDomain || '');
      setLogoUrl(wl.logoUrl || '');
      setHideBranding(Boolean(wl.hideAlurichatBranding));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar marca');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateWhiteLabel({
        appName: appName.trim() || undefined,
        primaryColor: primaryColor.trim() || undefined,
        customDomain: customDomain.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        hideAlurichatBranding: hideBranding,
      });
      toast.success('Marca atualizada');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppTopbar
        title="Marca"
        subtitle="White-label: nome, cores e domínio personalizado"
      />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <div className="mx-auto max-w-lg space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form
            onSubmit={onSave}
            className="mx-auto max-w-lg space-y-4 rounded-xl border border-surface-border bg-surface-raised/40 p-5"
          >
            <Input
              label="Nome da aplicação"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Ex.: Minha Empresa Chat"
            />
            <label className="block text-sm text-ink-muted">
              Cor primária
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-surface-border bg-transparent"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-surface-border bg-surface-overlay px-3 text-sm text-ink"
                />
              </div>
            </label>
            <Input
              label="Domínio personalizado"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="chat.minhaempresa.com"
            />
            <Input
              label="URL do logótipo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={hideBranding}
                onChange={(e) => setHideBranding(e.target.checked)}
                className="h-4 w-4 rounded border-surface-border"
              />
              Ocultar branding ALURICHAT
            </label>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>
                Guardar marca
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
