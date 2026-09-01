'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import {
  Building2,
  Check,
  FileText,
  ImageIcon,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

type ProfileForm = {
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string;
};

function asSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function statusLabel(status?: string) {
  if (status === 'SUSPENDED') return 'Suspensa';
  if (status === 'TRIAL') return 'Trial';
  return 'Ativa';
}

function InfoTile({
  icon,
  label,
  value,
  className = '',
  children,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-white/10 bg-[#22262b] px-4 py-3.5 ${className}`}
    >
      <span className="mt-0.5 text-emerald-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        {children ?? (
          <p className="mt-0.5 truncate text-sm font-medium text-white">
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SettingsEmpresaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [settingsRest, setSettingsRest] = useState<Record<string, unknown>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileForm>({
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
    logoUrl: '',
  });

  const logoSrc = api.mediaUrl(form.logoUrl);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api.getSettings();
      const settings = asSettings(t.settings);
      const { nif, email, phone, address, ...rest } = settings;
      setSettingsRest(rest);
      setStatus(String(t.status || 'ACTIVE'));
      setForm({
        name: String(t.name || ''),
        nif: String(nif ?? settings.cnpj ?? ''),
        email: String(email ?? ''),
        phone: String(phone ?? ''),
        address: String(address ?? ''),
        logoUrl: String(t.logoUrl || ''),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onLogoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem (PNG, JPG, WEBP ou GIF)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2 MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const updated = await api.uploadTenantLogo(file);
      setField('logoUrl', String(updated.logoUrl || ''));
      toast.success('Logotipo carregado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar imagem');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || undefined,
        settings: {
          ...settingsRest,
          nif: form.nif.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
        },
      });
      toast.success('Perfil da empresa atualizado');
      setEditing(false);
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
        title="Perfil da Empresa"
        subtitle="Dados públicos e identidade do seu tenant"
      />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <Skeleton className="mx-auto h-80 max-w-3xl" />
        ) : editing ? (
          <form
            onSubmit={onSave}
            className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-white/10 bg-[#1a1d21] p-5 md:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Editar empresa</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  void load();
                }}
              >
                Cancelar
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome"
                required
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
              <Input
                label="NIF"
                value={form.nif}
                onChange={(e) => setField('nif', e.target.value)}
                placeholder="000000000"
              />
              <Input
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contato@empresa.com"
              />
              <Input
                label="Telefone"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="900000000"
              />
              <div className="sm:col-span-2">
                <Input
                  label="Endereço"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <span className="text-sm font-medium text-ink-muted">Logotipo</span>
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoSrc}
                        alt="Pré-visualização do logotipo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm text-zinc-300">
                      PNG, JPG, WEBP ou GIF · máx. 2 MB
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={onLogoSelected}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        loading={uploadingLogo}
                        onClick={() => fileRef.current?.click()}
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        <Upload className="h-4 w-4" />
                        Carregar imagem
                      </Button>
                      {form.logoUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setField('logoUrl', '')}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving} className="bg-emerald-600 hover:bg-emerald-500">
                Salvar
              </Button>
            </div>
          </form>
        ) : (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#1a1d21] shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-600 px-5 py-5 md:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/20">
                  {logoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoSrc}
                      alt={form.name || 'Logotipo'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-7 w-7 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-white md:text-2xl">
                    {form.name || 'Empresa'}
                  </h2>
                  <p className="truncate text-sm text-emerald-50/90">
                    {form.email || 'Sem e-mail'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
                  <Check className="h-3.5 w-3.5" />
                  {statusLabel(status)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-emerald-700/40 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700/70"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 md:p-5">
              <InfoTile
                icon={<Building2 className="h-4 w-4" />}
                label="Nome"
                value={form.name}
              />
              <InfoTile
                icon={<FileText className="h-4 w-4" />}
                label="NIF"
                value={form.nif}
              />
              <InfoTile
                icon={<Mail className="h-4 w-4" />}
                label="E-mail"
                value={form.email}
              />
              <InfoTile
                icon={<Phone className="h-4 w-4" />}
                label="Telefone"
                value={form.phone}
              />
              <InfoTile
                icon={<MapPin className="h-4 w-4" />}
                label="Endereço"
                value={form.address}
                className="sm:col-span-2"
              />
              <InfoTile
                icon={<ImageIcon className="h-4 w-4" />}
                label="Logotipo"
                className="sm:col-span-2"
              >
                {logoSrc ? (
                  <div className="mt-1.5 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoSrc}
                      alt="Logotipo"
                      className="h-12 w-12 rounded-lg border border-white/10 object-cover"
                    />
                    <p className="text-sm font-medium text-white">Imagem definida</p>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-white">Não definido</p>
                )}
              </InfoTile>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
