'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Channel } from '@/lib/api';
import {
  Copy,
  KeyRound,
  LogOut,
  MessageSquare,
  QrCode,
  Settings,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

function statusLabel(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'CONNECTED') return 'Conectado';
  if (s === 'CONNECTING') return 'Aguardando QR';
  if (s === 'DISCONNECTED') return 'Desconectado';
  if (s === 'ERROR') return 'Erro';
  if (s === 'DEGRADED') return 'Instável';
  return status || '—';
}

function statusTone(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'CONNECTED') return 'success' as const;
  if (s === 'ERROR' || s === 'DISCONNECTED') return 'danger' as const;
  if (s === 'CONNECTING' || s === 'DEGRADED') return 'warning' as const;
  return 'default' as const;
}

export default function WhatsAppInstancesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [healthById, setHealthById] = useState<
    Record<string, { status?: string; uptimeLabel?: string }>
  >({});

  const [bearerOpen, setBearerOpen] = useState(false);
  const [bearerHeader, setBearerHeader] = useState<string | null>(null);
  const [pendingQrChannel, setPendingQrChannel] = useState<Channel | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrChannel, setQrChannel] = useState<Channel | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('CONNECTING');
  const [qrError, setQrError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const instances = useMemo(
    () => channels.filter((c) => (c.type || '').toUpperCase() === 'WHATSAPP'),
    [channels],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listChannels();
      setChannels(list);
      const wa = list.filter((c) => (c.type || '').toUpperCase() === 'WHATSAPP');
      const healthEntries = await Promise.all(
        wa.map(async (ch) => {
          try {
            const h = await api.getChannelHealth(ch.id);
            const secs = h.uptimeHints?.uptimeSeconds;
            let uptimeLabel: string | undefined;
            if (typeof secs === 'number' && secs > 0) {
              const hrs = Math.floor(secs / 3600);
              const mins = Math.floor((secs % 3600) / 60);
              uptimeLabel = hrs > 0 ? `${hrs}h ${mins}m uptime` : `${mins}m uptime`;
            }
            return [ch.id, { status: h.status, uptimeLabel }] as const;
          } catch {
            return [ch.id, { status: ch.status }] as const;
          }
        }),
      );
      setHealthById(Object.fromEntries(healthEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar instâncias');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  function startPolling(channelId: string) {
    stopPolling();
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const session = await api.getChannelSession(channelId);
          setQrStatus(session.status);
          if (session.qrCode) {
            setQrCode(session.qrCode);
            setQrError(null);
          }
          if (session.error && !session.qrCode) setQrError(session.error);
          if (session.status === 'CONNECTED') {
            stopPolling();
            toast.success(
              session.phoneNumber
                ? `WhatsApp conectado (${session.phoneNumber})`
                : 'WhatsApp conectado',
            );
            setTimeout(() => {
              setQrOpen(false);
              void load();
            }, 800);
          }
          if (session.status === 'ERROR') {
            stopPolling();
          }
        } catch {
          // keep polling briefly
        }
      })();
    }, 2000);
  }

  async function openQrFlow(channel: Channel) {
    setBusyId(channel.id);
    setQrChannel(channel);
    setQrCode(null);
    setQrError(null);
    setQrStatus('CONNECTING');
    setQrOpen(true);
    try {
      const result = await api.connectChannel(channel.id);
      const qr =
        (result as { qrCode?: string | null }).qrCode ||
        (result as { connectResult?: { sessionData?: { qrCode?: string } } })
          .connectResult?.sessionData?.qrCode ||
        null;
      if (qr) setQrCode(qr);
      setQrStatus((result.status as string) || 'CONNECTING');
      startPolling(channel.id);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'Falha ao iniciar QR');
      setQrStatus('ERROR');
      toast.error(err instanceof Error ? err.message : 'Falha ao conectar');
    } finally {
      setBusyId(null);
    }
  }

  async function createNativeInstance() {
    if (!name.trim()) {
      toast.error('Informe o nome da instância');
      return;
    }
    setCreating(true);
    try {
      const instanceName = name.trim();
      const channel = await api.createChannel({
        name: instanceName,
        type: 'WHATSAPP',
        provider: 'ALURICHAT',
      });

      // Prefer key from API; if missing (API antiga), cria agora
      let authorization =
        channel.apiKey?.authorization ||
        (channel.apiKey?.rawKey ? `Bearer ${channel.apiKey.rawKey}` : null);

      if (!authorization) {
        try {
          const key = await api.createApiKey({
            name: `Instância: ${instanceName}`,
            scopes: ['*', `channel:${channel.id}`],
          });
          if (key.rawKey) {
            authorization = `Bearer ${key.rawKey}`;
          }
        } catch {
          // continua — ainda assim tentamos avisar
        }
      }

      setName('');
      setModalOpen(false);
      void load();

      if (authorization) {
        try {
          sessionStorage.setItem(
            'alurichat_last_instance_bearer',
            authorization,
          );
          sessionStorage.setItem(
            'alurichat_last_instance_id',
            channel.id,
          );
        } catch {
          // ignore
        }
        setBearerHeader(authorization);
        setPendingQrChannel(channel);
        setBearerOpen(true);
        toast.success('Instância criada — copie o Authorization: Bearer');
      } else {
        toast.error(
          'Instância criada, mas não foi possível gerar o Bearer. Crie uma API key em Integrações → API.',
        );
        setPendingQrChannel(channel);
        await openQrFlow(channel);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar instância');
    } finally {
      setCreating(false);
    }
  }

  async function continueToQr() {
    setBearerOpen(false);
    const channel = pendingQrChannel;
    setPendingQrChannel(null);
    if (channel) await openQrFlow(channel);
  }

  async function disconnect(id: string) {
    setBusyId(id);
    try {
      await api.disconnectChannel(id);
      toast.success('Instância desconectada');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao desconectar');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Excluir a instância "${label}"?`)) return;
    setBusyId(id);
    try {
      await api.deleteChannel(id);
      toast.success('Instância removida');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AppTopbar title="Instâncias WhatsApp" subtitle="Gerencie suas conexões do WhatsApp" />

      <div className="flex items-center justify-end border-b border-surface-border px-5 py-4">
        <Button
          className="bg-emerald-600 hover:bg-emerald-500"
          onClick={() => setModalOpen(true)}
        >
          + Nova Instância
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : instances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center">
            <p className="text-sm text-ink-muted">Nenhuma instância ainda.</p>
            <Button
              className="mt-4 bg-emerald-600 hover:bg-emerald-500"
              onClick={() => setModalOpen(true)}
            >
              + Nova Instância
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {instances.map((ch) => {
              const connected = (ch.status || '').toUpperCase() === 'CONNECTED';
              const health = healthById[ch.id];
              return (
                <div
                  key={ch.id}
                  className="flex flex-col rounded-xl border border-surface-border bg-slate-900/70 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-ink">
                          {ch.name}
                        </h3>
                        <button
                          type="button"
                          className="rounded p-1 text-ink-faint hover:bg-white/5 hover:text-ink"
                          title="Configurações"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={statusTone(ch.status)}>
                          {statusLabel(ch.status)}
                        </Badge>
                        {health?.uptimeLabel ? (
                          <Badge tone="success">{health.uptimeLabel}</Badge>
                        ) : health?.status && health.status !== ch.status ? (
                          <Badge tone="default">Health: {health.status}</Badge>
                        ) : null}
                      </div>
                      {ch.phoneNumber ? (
                        <p className="mt-2 text-xs text-ink-muted">{ch.phoneNumber}</p>
                      ) : (
                        <p className="mt-2 text-xs text-ink-faint">
                          Instância nativa · QR WhatsApp
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/whatsapp/instancias/${ch.id}/playground`}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-border bg-slate-800 px-3 text-sm text-ink hover:bg-slate-700"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Mensagens
                    </Link>

                    {connected ? (
                      <button
                        type="button"
                        disabled={busyId === ch.id}
                        onClick={() => void disconnect(ch.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Desconectar
                      </button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === ch.id}
                        onClick={() => void openQrFlow(ch)}
                      >
                        <QrCode className="h-4 w-4" />
                        Conectar QR
                      </Button>
                    )}

                    <button
                      type="button"
                      disabled={busyId === ch.id}
                      onClick={() => void remove(ch.id, ch.name)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-700/90 px-3 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Deletar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !creating && setModalOpen(false)}
        title="Nova instância WhatsApp"
      >
        <p className="mb-4 text-sm text-ink-muted">
          Cria uma instância nativa no Alurichat. É gerada automaticamente uma chave{' '}
          <strong className="text-ink">Authorization: Bearer</strong> para a API. Em
          seguida escaneie o QR Code.
        </p>
        <Input
          label="Nome da instância"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Odontologia, Comercial SP"
          autoFocus
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={creating} onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-500"
            loading={creating}
            onClick={() => void createNativeInstance()}
          >
            Criar e gerar QR
          </Button>
        </div>
      </Modal>

      <Modal
        open={bearerOpen}
        onClose={() => undefined}
        closable={false}
        title="Authorization: Bearer"
        size="md"
      >
        <div className="space-y-3">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Guarde esta chave agora. Não será mostrada outra vez.
          </p>
          <p className="text-sm text-ink-muted">
            Use este header em todos os pedidos à API desta instância:
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <code className="flex-1 break-all font-mono text-xs text-emerald-200">
              {bearerHeader}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!bearerHeader) return;
                void navigator.clipboard.writeText(bearerHeader);
                toast.success('Authorization: Bearer copiado');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => void continueToQr()}
            >
              Já copiei — continuar para QR
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={qrOpen}
        onClose={() => {
          stopPolling();
          setQrOpen(false);
          void load();
        }}
        title={qrChannel ? `Conectar · ${qrChannel.name}` : 'Conectar WhatsApp'}
        size="md"
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-ink-muted">
            Abra o WhatsApp no celular →{' '}
            <strong className="text-ink">Aparelhos conectados</strong> →{' '}
            <strong className="text-ink">Conectar um aparelho</strong> e escaneie o
            código.
          </p>

          <div className="mx-auto flex h-72 w-72 items-center justify-center rounded-2xl border border-surface-border bg-white p-3">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <QrCode className="mx-auto h-10 w-10 animate-pulse" />
                <p>Gerando QR Code…</p>
              </div>
            )}
          </div>

          <Badge tone={statusTone(qrStatus)}>{statusLabel(qrStatus)}</Badge>
          {qrError ? <p className="text-sm text-red-400">{qrError}</p> : null}

          <div className="flex justify-center gap-2 pt-2">
            {qrChannel ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void openQrFlow(qrChannel)}
              >
                Atualizar QR
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopPolling();
                setQrOpen(false);
                void load();
              }}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
