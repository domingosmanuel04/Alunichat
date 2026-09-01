'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import {
  Bell,
  CheckCheck,
  Shield,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

const PREFS_KEY = 'alurichat.notificationPrefs';

type Prefs = {
  enabled: boolean;
  sound: boolean;
};

type NotificationItem = {
  id: string;
  title?: string;
  body?: string;
  readAt?: string | null;
  createdAt?: string;
};

function readPrefs(): Prefs {
  if (typeof window === 'undefined') return { enabled: true, sound: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { enabled: true, sound: true };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      enabled: parsed.enabled !== false,
      sound: parsed.sound !== false,
    };
  } catch {
    return { enabled: true, sound: true };
  }
}

function writePrefs(prefs: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function permissionLabel(permission: NotificationPermission | 'unsupported') {
  if (permission === 'unsupported') return 'Não suportadas';
  if (permission === 'granted') return 'Permitidas';
  if (permission === 'denied') return 'Bloqueadas';
  return 'Não solicitadas';
}

function PrefRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-zinc-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
        </div>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-sky-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function SettingsNotificacoesPage() {
  const [prefs, setPrefs] = useState<Prefs>({ enabled: true, sound: true });
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaActing, setMfaActing] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.listNotifications()) as NotificationItem[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMfa = useCallback(async () => {
    setMfaLoading(true);
    try {
      const status = await api.getMfaStatus();
      setMfaEnabled(Boolean(status.enabled));
    } catch {
      setMfaEnabled(false);
    } finally {
      setMfaLoading(false);
    }
  }, []);

  useEffect(() => {
    setPrefs(readPrefs());
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
    } else {
      setPermission(Notification.permission);
    }
    void loadNotifications();
    void loadMfa();
  }, [loadNotifications, loadMfa]);

  function updatePrefs(patch: Partial<Prefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writePrefs(next);
      return next;
    });
  }

  async function requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador não suporta notificações');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        updatePrefs({ enabled: true });
        toast.success('Permissão concedida');
      } else if (result === 'denied') {
        toast.error('Permissão bloqueada nas definições do navegador');
      }
    } catch {
      toast.error('Não foi possível solicitar permissão');
    }
  }

  async function markAll() {
    setMarking(true);
    try {
      await api.markAllNotificationsRead();
      toast.success('Todas marcadas como lidas');
      await loadNotifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    } finally {
      setMarking(false);
    }
  }

  async function markOne(id: string) {
    try {
      await api.markNotificationRead(id);
      await loadNotifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    }
  }

  async function toggleMfa() {
    setMfaActing(true);
    try {
      if (mfaEnabled) {
        await api.disableMfa();
        setMfaEnabled(false);
        setMfaSecret(null);
        toast.success('2FA desativado');
      } else {
        const result = await api.enableMfa();
        setMfaEnabled(true);
        setMfaSecret(result.secret || null);
        toast.success(
          result.currentCode
            ? `2FA ativado · código atual: ${result.currentCode}`
            : '2FA ativado — guarde o segredo',
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no 2FA');
    } finally {
      setMfaActing(false);
    }
  }

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <AppTopbar
        title="Configurações"
        subtitle="Preferências do painel (salvas neste navegador)."
      />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#1a1d21] p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-zinc-400">
                <Shield className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  Autenticação de dois fatores (2FA)
                </p>
                <p className="mt-0.5 text-sm text-zinc-400">
                  Proteja o login com um código temporário.
                </p>
                {mfaLoading ? (
                  <Skeleton className="mt-3 h-9 w-40" />
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      loading={mfaActing}
                      variant={mfaEnabled ? 'danger' : 'secondary'}
                      onClick={() => void toggleMfa()}
                    >
                      {mfaEnabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                    </Button>
                    <span className="text-xs text-zinc-500">
                      Estado: {mfaEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                )}
                {mfaSecret ? (
                  <p className="mt-2 break-all rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-zinc-300">
                    Segredo: {mfaSecret}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a1d21] p-5">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Notificações</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Quando chegar nova mensagem no Chat (incluindo conversas em
                  aguardando).
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-white/10 border-t border-white/10">
              <PrefRow
                icon={<Bell className="h-4 w-4" />}
                title="Ativar notificações"
                description="Notificação do navegador e indicador na aba quando chegar nova mensagem."
                checked={prefs.enabled}
                onChange={(enabled) => updatePrefs({ enabled })}
              />
              <PrefRow
                icon={<Volume2 className="h-4 w-4" />}
                title="Reproduzir som"
                description="Tocar um som ao receber nova mensagem (quando as notificações estiverem ativas)."
                checked={prefs.sound}
                disabled={!prefs.enabled}
                onChange={(sound) => updatePrefs({ sound })}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="text-sm text-zinc-400">
                Notificações do navegador:{' '}
                <span className="text-zinc-300">{permissionLabel(permission)}</span>
              </p>
              {permission !== 'granted' && permission !== 'unsupported' ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void requestPermission()}
                  className="bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800/70"
                >
                  Solicitar permissão
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#1a1d21] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Centro de notificações
                </h3>
                <p className="mt-0.5 text-sm text-zinc-400">
                  {unread > 0
                    ? `${unread} não lida(s) · ${items.length} no total`
                    : `${items.length} notificação(ões)`}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={marking}
                disabled={unread === 0}
                onClick={() => void markAll()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lida
              </Button>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
                  Sem notificações.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((n) => (
                    <li
                      key={n.id}
                      className={
                        n.readAt
                          ? 'rounded-lg border border-white/10 px-3 py-2.5 opacity-60'
                          : 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5'
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">
                            {n.title || '—'}
                          </p>
                          {n.body ? (
                            <p className="mt-0.5 text-sm text-zinc-400">{n.body}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-zinc-500">
                            {n.createdAt
                              ? new Date(n.createdAt).toLocaleString('pt-PT')
                              : ''}
                          </p>
                        </div>
                        {!n.readAt ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void markOne(n.id)}
                          >
                            Marcar lida
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
