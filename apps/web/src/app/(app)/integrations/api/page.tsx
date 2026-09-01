'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { api, type Channel } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  Copy,
  Download,
  KeyRound,
  Plus,
} from 'lucide-react';

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
    /\/$/,
    '',
  );
}

function CodeBlock({
  children,
  copyText,
}: {
  children: string;
  copyText?: string;
}) {
  async function copy() {
    await navigator.clipboard.writeText(copyText ?? children);
    toast.success('Copiado');
  }
  return (
    <div className="relative mt-2 overflow-hidden rounded-lg border border-surface-border bg-black/40">
      <button
        type="button"
        onClick={() => void copy()}
        className="absolute right-2 top-2 rounded-md p-1.5 text-ink-faint hover:bg-white/5 hover:text-ink"
        aria-label="Copiar"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <pre className="overflow-x-auto p-3 pr-10 font-mono text-[12px] leading-relaxed text-emerald-200/90 whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: ReactNode;
}) {
  const tone =
    method === 'GET'
      ? 'bg-sky-500/20 text-sky-300'
      : method === 'POST'
        ? 'bg-emerald-500/20 text-emerald-300'
        : method === 'PATCH'
          ? 'bg-amber-500/20 text-amber-200'
          : method === 'DELETE'
            ? 'bg-red-500/20 text-red-300'
            : 'bg-white/10 text-ink-muted';
  return (
    <div className="rounded-lg border border-surface-border/80 bg-surface-raised/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-0.5 font-mono text-[11px] font-semibold',
            tone,
          )}
        >
          {method}
        </span>
        <code className="font-mono text-xs text-ink">{path}</code>
      </div>
      <div className="mt-2 text-sm text-ink-muted">{children}</div>
    </div>
  );
}

type SectionId =
  | 'auth'
  | 'instances'
  | 'messages'
  | 'conversations'
  | 'webhooks'
  | 'websocket';

const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'auth', title: 'Autenticação' },
  { id: 'instances', title: 'Instâncias' },
  { id: 'messages', title: 'Mensagens' },
  { id: 'conversations', title: 'Conversas e Chat' },
  { id: 'webhooks', title: 'Webhooks' },
  { id: 'websocket', title: 'WebSocket (Chat em tempo real)' },
];

export default function IntegrationsApiPage() {
  const [openId, setOpenId] = useState<SectionId | null>('auth');
  const [keyModal, setKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [createdForInstance, setCreatedForInstance] = useState<string | null>(
    null,
  );

  const base = useMemo(() => apiBase(), []);

  const whatsappInstances = useMemo(
    () =>
      channels.filter((c) => (c.type || '').toUpperCase() === 'WHATSAPP'),
    [channels],
  );

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      setChannels(await api.listChannels());
    } catch {
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  // Mostra Bearer real se foi criado agora ou na última instância WhatsApp
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('alurichat_last_instance_bearer');
      if (stored?.startsWith('Bearer ')) {
        setRawKey(stored.replace(/^Bearer\s+/i, ''));
        setOpenId('instances');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (keyModal && !rawKey) {
      void loadChannels();
    }
  }, [keyModal, rawKey, loadChannels]);

  const bearerExample = rawKey
    ? `Authorization: Bearer ${rawKey}`
    : 'Authorization: Bearer <seu_access_token_ou_api_key>';

  function toggle(id: SectionId) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  function openCreateKeyModal() {
    setRawKey(null);
    setCreatedForInstance(null);
    setKeyName('');
    setChannelId('');
    setKeyModal(true);
  }

  async function onCreateKey(e: FormEvent) {
    e.preventDefault();
    if (!channelId) {
      toast.error('Selecione uma instância');
      return;
    }
    const instance = whatsappInstances.find((c) => c.id === channelId);
    const name =
      keyName.trim() ||
      (instance ? `Instância: ${instance.name}` : 'API key');

    setSaving(true);
    try {
      const created = await api.createApiKey({
        name,
        scopes: ['*', `channel:${channelId}`],
      });
      const token = created.rawKey || null;
      setRawKey(token);
      setCreatedForInstance(instance?.name || channelId);
      setKeyName('');
      setOpenId('instances');
      if (token) {
        try {
          sessionStorage.setItem(
            'alurichat_last_instance_bearer',
            `Bearer ${token}`,
          );
          sessionStorage.setItem('alurichat_last_instance_id', channelId);
        } catch {
          // ignore
        }
      }
      toast.success('Chave criada — use Authorization: Bearer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  function downloadPostman() {
    const collection = {
      info: {
        name: 'Alurichat API',
        description: 'Collection gerada pela documentação Alurichat',
        schema:
          'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [
        { key: 'baseUrl', value: `${base}/api/v1` },
        { key: 'token', value: rawKey || '' },
        { key: 'tenantSlug', value: 'demo' },
      ],
      item: [
        {
          name: 'Autenticação',
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      email: 'owner@demo.alurichat.com',
                      password: 'DemoOwner123!',
                      tenantSlug: 'demo',
                    },
                    null,
                    2,
                  ),
                },
                url: '{{baseUrl}}/auth/login',
              },
            },
            {
              name: 'Me',
              request: {
                method: 'GET',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                ],
                url: '{{baseUrl}}/auth/me',
              },
            },
          ],
        },
        {
          name: 'Instâncias',
          item: [
            {
              name: 'Listar canais',
              request: {
                method: 'GET',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                ],
                url: '{{baseUrl}}/channels',
              },
            },
            {
              name: 'Criar instância WhatsApp',
              request: {
                method: 'POST',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                  { key: 'Content-Type', value: 'application/json' },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      name: 'WhatsApp Principal',
                      type: 'WHATSAPP',
                      provider: 'ALURICHAT',
                    },
                    null,
                    2,
                  ),
                },
                url: '{{baseUrl}}/channels',
              },
            },
            {
              name: 'Conectar (QR)',
              request: {
                method: 'POST',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                ],
                url: '{{baseUrl}}/channels/:id/connect',
              },
            },
          ],
        },
        {
          name: 'Mensagens',
          item: [
            {
              name: 'Enviar texto',
              request: {
                method: 'POST',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                  { key: 'Content-Type', value: 'application/json' },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    { to: '244900000000', message: 'Olá via API' },
                    null,
                    2,
                  ),
                },
                url: '{{baseUrl}}/channels/:id/messages/text',
              },
            },
          ],
        },
        {
          name: 'Conversas',
          item: [
            {
              name: 'Listar conversas',
              request: {
                method: 'GET',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                ],
                url: '{{baseUrl}}/conversations',
              },
            },
          ],
        },
        {
          name: 'Webhooks',
          item: [
            {
              name: 'Listar webhooks',
              request: {
                method: 'GET',
                header: [
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                  { key: 'X-Tenant-Slug', value: '{{tenantSlug}}' },
                ],
                url: '{{baseUrl}}/webhooks',
              },
            },
          ],
        },
      ],
    };

    const blob = new Blob([JSON.stringify(collection, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alurichat-api.postman_collection.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Collection Postman descarregada');
  }

  return (
    <>
      <AppTopbar
        title="Documentação da API"
        subtitle="Como utilizar os endpoints com autenticação JWT"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
            onClick={downloadPostman}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar collection Postman
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-5 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            Base URL:{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-ink">
              {base}/api/v1
            </code>
          </p>
          <Button size="sm" variant="secondary" onClick={openCreateKeyModal}>
            <Plus className="h-3.5 w-3.5" />
            Nova API key
          </Button>
        </div>

        {rawKey ? (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-200">
              Nova chave criada — use este header em todos os pedidos:
            </p>
            <CodeBlock copyText={bearerExample}>{bearerExample}</CodeBlock>
            <p className="mt-2 text-xs text-ink-muted">
              Guarde a chave agora. Não será mostrada outra vez. Em Instâncias
              abaixo há o exemplo completo de criar canal com este Bearer.
            </p>
          </div>
        ) : null}

        <div className="mx-auto max-w-3xl divide-y divide-surface-border rounded-xl border border-surface-border">
          {SECTIONS.map((section) => {
            const open = openId === section.id;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink transition hover:bg-white/[0.03]"
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 text-ink-faint transition',
                      open && 'rotate-90 text-ink',
                    )}
                  />
                  {section.title}
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-surface-border/60 bg-black/20 px-4 py-4">
                    {section.id === 'auth' ? (
                      <>
                        <p>
                          Obtenha um <strong className="text-ink">JWT</strong>{' '}
                          via login ou use uma{' '}
                          <strong className="text-ink">API key</strong>. Em
                          ambos os casos envie:
                        </p>
                        <CodeBlock>{`Authorization: Bearer <token>
X-Tenant-Slug: demo`}</CodeBlock>
                        <Endpoint method="POST" path="/auth/login">
                          Login com email e password. Resposta inclui{' '}
                          <code className="text-ink">accessToken</code> e{' '}
                          <code className="text-ink">tokenType: &quot;Bearer&quot;</code>.
                          <CodeBlock>{`curl -X POST ${base}/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "owner@demo.alurichat.com",
    "password": "DemoOwner123!",
    "tenantSlug": "demo"
  }'`}</CodeBlock>
                        </Endpoint>
                        <Endpoint method="POST" path="/auth/refresh">
                          Renova o access token com o{' '}
                          <code className="text-ink">refreshToken</code>.
                        </Endpoint>
                        <Endpoint method="GET" path="/auth/me">
                          Utilizador autenticado. Requer{' '}
                          <code className="text-ink">Authorization: Bearer</code>.
                        </Endpoint>
                        <Endpoint method="POST" path="/api-keys">
                          Cria uma API key permanente (prefixo{' '}
                          <code className="text-ink">alc_</code>). Use o botão
                          «Nova API key» acima; o header Bearer é mostrado ao
                          criar.
                        </Endpoint>
                      </>
                    ) : null}

                    {section.id === 'instances' ? (
                      <>
                        <p>
                          Instâncias = canais WhatsApp. Ao{' '}
                          <strong className="text-ink">criar uma nova instância</strong>, o
                          sistema gera automaticamente uma API key e devolve o header:
                        </p>
                        <CodeBlock copyText={bearerExample}>
                          {bearerExample}
                        </CodeBlock>
                        <p className="text-sm">
                          Guarde o <code className="text-ink">rawKey</code> /{' '}
                          <code className="text-ink">authorization</code> da resposta —
                          só aparece uma vez. Todos os pedidos seguintes usam esse Bearer
                          (ou um JWT de login).
                        </p>
                        <Endpoint method="GET" path="/channels">
                          Lista as instâncias da empresa.
                        </Endpoint>
                        <Endpoint method="POST" path="/channels">
                          Cria uma nova instância WhatsApp e devolve{' '}
                          <code className="text-ink">apiKey.authorization</code>.
                          <CodeBlock>{`curl -X POST ${base}/api/v1/channels \\
  -H "Authorization: Bearer <token_jwt>" \\
  -H "X-Tenant-Slug: demo" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "WhatsApp Principal",
    "type": "WHATSAPP",
    "provider": "ALURICHAT"
  }'

# Resposta inclui:
# "apiKey": {
#   "rawKey": "alc_…",
#   "authorization": "Bearer alc_…"
# }`}</CodeBlock>
                        </Endpoint>
                        <Endpoint method="POST" path="/channels/:id/connect">
                          Inicia ligação (gera QR Code). Depois consulte{' '}
                          <code className="text-ink">GET /channels/:id/session</code>.
                        </Endpoint>
                        <Endpoint method="GET" path="/channels/:id/session">
                          Estado da sessão e QR (se pendente).
                        </Endpoint>
                        <Endpoint method="POST" path="/channels/:id/disconnect">
                          Desliga a sessão WhatsApp.
                        </Endpoint>
                        <Endpoint method="DELETE" path="/channels/:id">
                          Remove a instância e revoga a API key associada.
                        </Endpoint>
                      </>
                    ) : null}

                    {section.id === 'messages' ? (
                      <>
                        <p>
                          Envio de mensagens pela instância. Header obrigatório:
                        </p>
                        <CodeBlock>{bearerExample}</CodeBlock>
                        <Endpoint method="POST" path="/channels/:id/messages/text">
                          Envia texto.
                          <CodeBlock>{`{
  "to": "244900000000",
  "message": "Olá via API Alurichat"
}`}</CodeBlock>
                        </Endpoint>
                        <Endpoint method="POST" path="/channels/:id/messages/media">
                          Envia media por URL (
                          <code className="text-ink">type</code>: image | audio |
                          document).
                        </Endpoint>
                        <Endpoint
                          method="POST"
                          path="/channels/:id/messages/media/upload"
                        >
                          Upload multipart de ficheiro.
                        </Endpoint>
                        <Endpoint method="POST" path="/channels/:id/messages/schedule">
                          Agenda envio para data futura.
                        </Endpoint>
                        <Endpoint method="POST" path="/channels/:id/check-number">
                          Verifica se o número existe no WhatsApp.
                        </Endpoint>
                      </>
                    ) : null}

                    {section.id === 'conversations' ? (
                      <>
                        <Endpoint method="GET" path="/conversations">
                          Lista conversas (inbox). Query: status, channelId,
                          search, page.
                        </Endpoint>
                        <Endpoint method="GET" path="/conversations/:id">
                          Detalhe da conversa com mensagens.
                        </Endpoint>
                        <Endpoint method="POST" path="/conversations/:id/messages">
                          Envia mensagem na conversa (requere Bearer).
                        </Endpoint>
                        <Endpoint method="POST" path="/conversations/:id/assign">
                          Atribui a um agente.
                        </Endpoint>
                        <Endpoint method="POST" path="/conversations/:id/transfer">
                          Transfere conversa.
                        </Endpoint>
                        <Endpoint method="PATCH" path="/conversations/:id/status">
                          Atualiza estado (OPEN, PENDING, CLOSED, …).
                        </Endpoint>
                      </>
                    ) : null}

                    {section.id === 'webhooks' ? (
                      <>
                        <p>
                          Configure em Integrações → Webhook. A API permite
                          CRUD e testes.
                        </p>
                        <Endpoint method="GET" path="/webhooks">
                          Lista webhooks.
                        </Endpoint>
                        <Endpoint method="POST" path="/webhooks">
                          Cria webhook (url, events, secret opcional, headers).
                        </Endpoint>
                        <Endpoint method="POST" path="/webhooks/:id/test">
                          Envia evento de teste para a URL configurada.
                        </Endpoint>
                        <Endpoint method="GET" path="/webhooks/deliveries">
                          Logs de envio/recebimento (ver Logs Webhook).
                        </Endpoint>
                        <Endpoint method="POST" path="/webhooks/inbox/:id">
                          Endpoint público para teste de recebimento (tipo
                          inbox).
                        </Endpoint>
                      </>
                    ) : null}

                    {section.id === 'websocket' ? (
                      <>
                        <p>
                          Namespace Socket.IO:{' '}
                          <code className="text-ink">{base}/realtime</code>
                        </p>
                        <p className="text-sm">
                          Autentique com o mesmo JWT no handshake:
                        </p>
                        <CodeBlock>{`// auth.token ou header Authorization
io("${base}/realtime", {
  auth: { token: "<accessToken>" }
});

// Eventos
socket.emit("conversation:join", { conversationId });
socket.emit("conversation:leave", { conversationId });
// Recebe mensagens em tempo real na sala da conversa`}</CodeBlock>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={keyModal}
        onClose={() => {
          setKeyModal(false);
        }}
        title={rawKey && keyModal ? 'API key criada' : 'Nova API key'}
      >
        {rawKey && keyModal ? (
          <div className="space-y-3">
            {createdForInstance ? (
              <p className="text-sm text-ink-muted">
                Chave ligada à instância{' '}
                <strong className="text-ink">{createdForInstance}</strong>.
              </p>
            ) : null}
            <p className="text-sm text-ink-muted">
              Use este header nos pedidos à API. Guarde agora — não será
              mostrada outra vez.
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <code className="flex-1 break-all font-mono text-xs text-emerald-200">
                {bearerExample}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(bearerExample);
                  toast.success('Bearer copiado');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setKeyModal(false);
                  setOpenId('instances');
                }}
              >
                Ver Instâncias
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onCreateKey} className="space-y-3">
            <Select
              label="Instância"
              required
              value={channelId}
              onChange={(e) => {
                const id = e.target.value;
                setChannelId(id);
                const inst = whatsappInstances.find((c) => c.id === id);
                if (inst && !keyName.trim()) {
                  setKeyName(`Instância: ${inst.name}`);
                }
              }}
              disabled={loadingChannels}
            >
              <option value="">
                {loadingChannels ? 'A carregar…' : 'Selecione'}
              </option>
              {whatsappInstances.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                  {ch.phoneNumber ? ` (${ch.phoneNumber})` : ''}
                </option>
              ))}
            </Select>
            {whatsappInstances.length === 0 && !loadingChannels ? (
              <p className="text-xs text-amber-200">
                Nenhuma instância WhatsApp. Crie uma em WhatsApp → Instâncias.
              </p>
            ) : null}
            <Input
              label="Nome (opcional)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Ex.: Integração ERP"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setKeyModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={saving}
                disabled={!channelId || whatsappInstances.length === 0}
              >
                Criar
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
