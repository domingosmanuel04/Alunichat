'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { useInboxStore } from '@/stores/inbox-store';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type UserOption = {
  id?: string;
  user?: { id?: string; name?: string; email?: string };
  name?: string;
  email?: string;
};

type ContextPayload = {
  deals?: { id?: string; title?: string; value?: number; stage?: { name?: string } }[];
  tickets?: { id?: string; number?: string | number; subject?: string; status?: string }[];
  openConversations?: number;
};

function userId(u: UserOption) {
  return String(u.user?.id || u.id || '');
}

function userLabel(u: UserOption) {
  return u.user?.name || u.name || u.user?.email || u.email || 'Utilizador';
}

export function ContactPanel() {
  const detail = useInboxStore((s) => s.detail);
  const selectConversation = useInboxStore((s) => s.selectConversation);
  const contact = detail?.contact;
  const [users, setUsers] = useState<UserOption[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [context, setContext] = useState<ContextPayload | null>(null);
  const [lgpdBusy, setLgpdBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listUsers();
        if (!cancelled) setUsers(list as UserOption[]);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!detail?.id) {
      setContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ctx = await api.getConversationContext(detail.id);
        if (!cancelled) {
          setContext({
            deals: (ctx.deals || []) as ContextPayload['deals'],
            tickets: (ctx.tickets || []) as ContextPayload['tickets'],
            openConversations: ctx.openConversations ?? 0,
          });
        }
      } catch {
        if (!cancelled) setContext(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.id]);

  if (!detail) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-ink-muted">
        Detalhes do contato aparecerão aqui
      </div>
    );
  }

  const currentAssignee = detail.assigneeId || detail.assignedToId || '';

  async function onAssign(assigneeId: string) {
    if (!detail || !assigneeId) return;
    setAssigning(true);
    try {
      await api.assignConversation(detail.id, assigneeId);
      toast.success('Conversa atribuída');
      await selectConversation(detail.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atribuir');
    } finally {
      setAssigning(false);
    }
  }

  async function onExportLgpd() {
    if (!contact?.id) return;
    setLgpdBusy(true);
    try {
      const data = await api.exportContactLgpd(contact.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lgpd-${contact.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportação LGPD descarregada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na exportação LGPD');
    } finally {
      setLgpdBusy(false);
    }
  }

  async function onEraseLgpd() {
    if (!contact?.id) return;
    if (!confirm('Anonimizar este contacto (LGPD)? Esta ação não pode ser desfeita.')) {
      return;
    }
    setLgpdBusy(true);
    try {
      await api.eraseContactLgpd(contact.id);
      toast.success('Contacto anonimizado');
      if (detail?.id) await selectConversation(detail.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao anonimizar');
    } finally {
      setLgpdBusy(false);
    }
  }

  async function onOptOut() {
    if (!contact?.id) return;
    setLgpdBusy(true);
    try {
      await api.optOutContact(contact.id, true);
      toast.success('Opt-out de marketing registado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no opt-out');
    } finally {
      setLgpdBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="flex flex-col items-center gap-3 border-b border-surface-border pb-5 text-center">
        <Avatar
          name={contact?.name || 'Contato'}
          src={
            typeof (contact?.metadata as { avatarUrl?: string } | undefined)?.avatarUrl ===
            'string'
              ? (contact?.metadata as { avatarUrl: string }).avatarUrl
              : typeof (detail.metadata as { avatarUrl?: string } | undefined)?.avatarUrl ===
                  'string'
                ? (detail.metadata as { avatarUrl: string }).avatarUrl
                : null
          }
          size="lg"
        />
        <div>
          <p className="font-display font-semibold text-ink">{contact?.name || 'Sem nome'}</p>
          <p className="text-xs text-ink-faint">{contact?.email || contact?.phone || '—'}</p>
        </div>
        {detail.channelType || detail.channel?.type ? (
          <Badge tone="brand">{detail.channelType || detail.channel?.type}</Badge>
        ) : null}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Status</dt>
          <dd className="text-ink">{detail.status || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Prioridade</dt>
          <dd className="text-ink">{detail.priority || '—'}</dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs text-ink-faint">Atribuir a</dt>
          <dd>
            <select
              className="h-9 w-full rounded-lg border border-surface-border bg-surface-overlay px-2 text-sm text-ink"
              value={currentAssignee || ''}
              disabled={assigning}
              onChange={(e) => void onAssign(e.target.value)}
            >
              <option value="">Selecionar…</option>
              {users.map((u) => {
                const id = userId(u);
                if (!id) return null;
                return (
                  <option key={id} value={id}>
                    {userLabel(u)}
                  </option>
                );
              })}
            </select>
          </dd>
        </div>
        {detail.departmentId ? (
          <div>
            <dt className="text-xs text-ink-faint">Departamento</dt>
            <dd className="font-mono text-xs text-ink">{detail.departmentId}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-ink-faint">Telefone</dt>
          <dd className="text-ink">{contact?.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">E-mail</dt>
          <dd className="truncate text-ink">{contact?.email || '—'}</dd>
        </div>
        {contact?.tags && contact.tags.length > 0 ? (
          <div>
            <dt className="mb-1.5 text-xs text-ink-faint">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {contact.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </dd>
          </div>
        ) : null}

        <div className="border-t border-surface-border pt-3">
          <dt className="text-xs text-ink-faint">Conversas abertas</dt>
          <dd className="text-ink">{context?.openConversations ?? '—'}</dd>
        </div>

        {context?.deals && context.deals.length > 0 ? (
          <div>
            <dt className="mb-1.5 text-xs text-ink-faint">Negócios</dt>
            <dd className="space-y-1.5">
              {context.deals.slice(0, 5).map((d) => (
                <div
                  key={String(d.id)}
                  className="rounded-lg border border-surface-border bg-surface-overlay px-2.5 py-1.5 text-xs"
                >
                  <p className="font-medium text-ink">{d.title || 'Negócio'}</p>
                  <p className="text-ink-faint">
                    {d.stage?.name || '—'}
                    {typeof d.value === 'number'
                      ? ` · ${d.value.toLocaleString('pt-BR')}`
                      : ''}
                  </p>
                </div>
              ))}
            </dd>
          </div>
        ) : null}

        {context?.tickets && context.tickets.length > 0 ? (
          <div>
            <dt className="mb-1.5 text-xs text-ink-faint">Tickets</dt>
            <dd className="space-y-1.5">
              {context.tickets.slice(0, 5).map((t) => (
                <div
                  key={String(t.id)}
                  className="rounded-lg border border-surface-border bg-surface-overlay px-2.5 py-1.5 text-xs"
                >
                  <p className="font-medium text-ink">
                    #{t.number ?? '—'} · {t.subject || 'Ticket'}
                  </p>
                  <p className="text-ink-faint">{t.status || '—'}</p>
                </div>
              ))}
            </dd>
          </div>
        ) : null}

        {contact?.id ? (
          <div className="space-y-2 border-t border-surface-border pt-3">
            <dt className="text-xs text-ink-faint">LGPD e marketing</dt>
            <dd className="flex flex-col gap-2">
              <button
                type="button"
                disabled={lgpdBusy}
                onClick={() => void onExportLgpd()}
                className="rounded-lg border border-surface-border px-2.5 py-1.5 text-left text-xs text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-50"
              >
                Exportar dados (LGPD)
              </button>
              <button
                type="button"
                disabled={lgpdBusy}
                onClick={() => void onEraseLgpd()}
                className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-left text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Apagar / anonimizar (LGPD)
              </button>
              <button
                type="button"
                disabled={lgpdBusy}
                onClick={() => void onOptOut()}
                className="rounded-lg border border-surface-border px-2.5 py-1.5 text-left text-xs text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-50"
              >
                Opt-out marketing
              </button>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
