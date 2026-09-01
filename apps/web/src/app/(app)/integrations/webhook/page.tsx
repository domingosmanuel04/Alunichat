'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, Channel } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, Send } from 'lucide-react';

type WebhookItem = {
  id: string;
  url?: string;
  events?: string[];
  active?: boolean;
  headers?: Record<string, string> | null;
  [key: string]: unknown;
};

const EVENT_OPTIONS = [
  {
    key: 'messages',
    label: 'Mensagens',
    events: ['message.sent', 'message.received'],
  },
  {
    key: 'receipts',
    label: 'Recebimentos/leituras',
    events: ['message.ack', 'message.read'],
  },
  {
    key: 'connection',
    label: 'Conexão',
    events: ['connection.open'],
  },
  {
    key: 'disconnection',
    label: 'Desconexão',
    events: ['connection.close'],
  },
] as const;

function apiPublicBase() {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return raw.replace(/\/$/, '');
}

function channelIdFromWebhook(w: WebhookItem): string | null {
  const headers = w.headers;
  if (!headers || typeof headers !== 'object') return null;
  const id = (headers as Record<string, string>).channelId;
  return id || null;
}

function selectedKeysFromEvents(events: string[] | undefined): string[] {
  if (!events?.length) return [];
  return EVENT_OPTIONS.filter((opt) =>
    opt.events.some((e) => events.includes(e)),
  ).map((opt) => opt.key);
}

function eventsFromKeys(keys: string[]): string[] {
  return EVENT_OPTIONS.filter((opt) => keys.includes(opt.key)).flatMap(
    (opt) => [...opt.events],
  );
}

export default function WebhookPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelId, setChannelId] = useState('');
  const [webhookId, setWebhookId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [eventKeys, setEventKeys] = useState<string[]>(['messages']);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const inboxUrl = useMemo(() => {
    if (!webhookId) return '';
    return `${apiPublicBase()}/api/v1/webhooks/inbox/${webhookId}`;
  }, [webhookId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chs, hooks] = await Promise.all([
        api.listChannels(),
        api.listWebhooks(),
      ]);
      setChannels(chs);
      setWebhooks(hooks as WebhookItem[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar');
      setChannels([]);
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!channelId) {
      setWebhookId(null);
      setUrl('');
      setSecret('');
      setEventKeys(['messages']);
      return;
    }
    const match = webhooks.find((w) => channelIdFromWebhook(w) === channelId);
    if (match) {
      setWebhookId(match.id);
      setUrl(match.url || '');
      setSecret('');
      setEventKeys(selectedKeysFromEvents(match.events));
    } else {
      setWebhookId(null);
      setUrl('');
      setSecret('');
      setEventKeys(['messages']);
    }
  }, [channelId, webhooks]);

  function toggleEvent(key: string) {
    setEventKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!channelId) {
      toast.error('Selecione uma instância');
      return;
    }
    if (!url.trim()) {
      toast.error('Indique a URL do webhook');
      return;
    }
    if (eventKeys.length === 0) {
      toast.error('Selecione pelo menos um evento');
      return;
    }
    if (!webhookId && secret.trim() && secret.trim().length < 8) {
      toast.error('Secret deve ter pelo menos 8 caracteres');
      return;
    }
    if (webhookId && secret.trim() && secret.trim().length < 8) {
      toast.error('Secret deve ter pelo menos 8 caracteres');
      return;
    }

    const events = eventsFromKeys(eventKeys);
    const headers = { channelId };

    setSaving(true);
    try {
      if (webhookId) {
        const body: {
          url: string;
          events: string[];
          headers: Record<string, string>;
          secret?: string;
          active?: boolean;
        } = {
          url: url.trim(),
          events,
          headers,
          active: true,
        };
        if (secret.trim()) body.secret = secret.trim();
        await api.updateWebhook(webhookId, body);
        toast.success('Webhook guardado');
      } else {
        const created = await api.createWebhook({
          url: url.trim(),
          events,
          headers,
          active: true,
          ...(secret.trim() ? { secret: secret.trim() } : {}),
        });
        setWebhookId(String(created.id));
        toast.success('Webhook guardado');
      }
      setSecret('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    if (!webhookId) {
      toast.error('Guarde o webhook antes de enviar o teste');
      return;
    }
    setTesting(true);
    try {
      await api.testWebhook(webhookId);
      toast.success('Teste enviado — veja em Logs Webhook');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no teste');
    } finally {
      setTesting(false);
    }
  }

  async function copyInbox() {
    if (!inboxUrl) return;
    await navigator.clipboard.writeText(inboxUrl);
    toast.success('URL copiada');
  }

  return (
    <>
      <AppTopbar
        title="Configuração de Webhook"
        subtitle="Configure a URL e os eventos para receber notificações das instâncias da sua empresa."
      />

      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <form onSubmit={onSave} className="mx-auto max-w-2xl space-y-5">
            <Select
              label="Instância"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                  {ch.phoneNumber ? ` (${ch.phoneNumber})` : ''}
                </option>
              ))}
            </Select>

            <Input
              label="URL do webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
            />

            <label className="flex w-full flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-muted">
                Secret (opcional, para assinatura HMAC)
              </span>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Deixe vazio para não alterar"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 pr-10 text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
                  aria-label={showSecret ? 'Ocultar secret' : 'Mostrar secret'}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            <div>
              <p className="mb-2.5 text-sm font-medium text-ink-muted">Eventos</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {EVENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={eventKeys.includes(opt.key)}
                      onChange={() => toggleEvent(opt.key)}
                      className="h-4 w-4 rounded border-surface-border accent-emerald-500"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="submit"
                loading={saving}
                className="bg-emerald-600 text-white shadow-none hover:bg-emerald-500"
              >
                Salvar
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={testing}
                disabled={!webhookId}
                onClick={() => void onTest()}
              >
                <Send className="h-4 w-4" />
                Enviar teste
              </Button>
            </div>

            <div className="mt-2 rounded-xl border border-surface-border bg-surface-raised/40 p-4">
              <h3 className="text-sm font-semibold text-ink">
                URL para teste de recebimento
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                Use esta URL no sistema externo para enviar um POST e validar que
                nosso sistema está recebendo. Os recebimentos aparecem nos Logs
                com tipo &quot;inbox&quot;.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={inboxUrl}
                  placeholder={
                    webhookId
                      ? undefined
                      : 'Guarde o webhook para obter a URL'
                  }
                  className="h-10 flex-1 rounded-lg border border-surface-border bg-surface-raised px-3 font-mono text-xs text-ink outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={!inboxUrl}
                  onClick={() => void copyInbox()}
                  aria-label="Copiar URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
