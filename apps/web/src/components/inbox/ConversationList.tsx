'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { useInboxStore } from '@/stores/inbox-store';
import { BookmarkPlus, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

function avatarFrom(meta?: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const url = (meta as Record<string, unknown>).avatarUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function isGroupConversation(c: {
  subject?: string | null;
  contact?: { phone?: string | null; metadata?: unknown; name?: string } | null;
  metadata?: unknown;
}) {
  const meta = (c.metadata || c.contact?.metadata || {}) as Record<string, unknown>;
  if (meta.isGroup === true) return true;
  const phone = c.contact?.phone || '';
  return phone.includes('@g.us');
}

function statusLabel(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'PENDING' || s === 'OPEN') return 'AGUARDANDO';
  if (s === 'ASSIGNED') return 'ATENDENDO';
  if (s === 'CLOSED' || s === 'RESOLVED') return 'FINALIZADO';
  return status || '—';
}

function statusTone(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'ASSIGNED') return 'success' as const;
  if (s === 'CLOSED' || s === 'RESOLVED') return 'default' as const;
  return 'warning' as const;
}

function slaBadge(dueAt?: string | null) {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const mins = (due - Date.now()) / 60000;
  if (mins < 0) return { label: 'SLA atrasado', tone: 'danger' as const };
  if (mins < 10) return { label: `SLA ${Math.ceil(mins)}m`, tone: 'warning' as const };
  return { label: `SLA ${Math.ceil(mins)}m`, tone: 'brand' as const };
}

type SavedFilter = {
  id: string;
  name: string;
  query: Record<string, unknown>;
};

export function ConversationList({ whatsappStyle = false }: { whatsappStyle?: boolean }) {
  const conversations = useInboxStore((s) => s.conversations);
  const selectedId = useInboxStore((s) => s.selectedId);
  const loadingList = useInboxStore((s) => s.loadingList);
  const selectConversation = useInboxStore((s) => s.selectConversation);
  const loadConversations = useInboxStore((s) => s.loadConversations);
  const queueFilter = useInboxStore((s) => s.queueFilter);

  const [search, setSearch] = useState('');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savingFilter, setSavingFilter] = useState(false);

  const refreshFilters = useCallback(async () => {
    try {
      const res = await api.listSavedFilters();
      setSavedFilters(
        (res.items || []).map((f) => ({
          id: String(f.id),
          name: String(f.name || 'Filtro'),
          query: f.query || {},
        })),
      );
    } catch {
      setSavedFilters([]);
    }
  }, []);

  useEffect(() => {
    void refreshFilters();
  }, [refreshFilters]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadConversations({ search: search.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [search, loadConversations]);

  async function onSaveFilter() {
    const name = window.prompt('Nome do filtro guardado');
    if (!name?.trim()) return;
    setSavingFilter(true);
    try {
      await api.saveFilter({
        name: name.trim(),
        query: {
          search: search.trim() || undefined,
          queue: queueFilter === 'all' ? undefined : queueFilter,
        },
      });
      toast.success('Filtro guardado');
      await refreshFilters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar filtro');
    } finally {
      setSavingFilter(false);
    }
  }

  function onApplyFilter(id: string) {
    const f = savedFilters.find((x) => x.id === id);
    if (!f) return;
    const q = String(f.query.search || '');
    setSearch(q);
    void loadConversations({
      search: q || undefined,
      queue:
        typeof f.query.queue === 'string' && f.query.queue
          ? String(f.query.queue)
          : undefined,
    });
  }

  return (
    <>
      {!whatsappStyle ? (
        <div className="border-b border-surface-border px-4 py-3">
          <p className="font-display text-sm font-semibold text-ink">Conversas</p>
          <p className="text-xs text-ink-faint">{conversations.length} na fila</p>
        </div>
      ) : null}

      <div className="space-y-2 border-b border-surface-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar conversas…"
            className="h-8 w-full rounded-lg border border-surface-border bg-surface-overlay pl-8 pr-2 text-xs text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <select
            className="h-8 min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-overlay px-2 text-xs text-ink"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = '';
              if (id) onApplyFilter(id);
            }}
          >
            <option value="">Filtros guardados…</option>
            {savedFilters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={savingFilter}
            onClick={() => void onSaveFilter()}
            title="Guardar filtro"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-surface-border px-2 text-xs text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingList ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-muted">
            Nenhuma conversa. Sincronize a instância ou aguarde mensagens.
          </div>
        ) : (
          <ul>
            {conversations.map((c) => {
              const active = c.id === selectedId;
              const group = isGroupConversation(c);
              const name =
                c.subject || c.contact?.name || (group ? 'Grupo' : 'Contato');
              const avatar =
                avatarFrom(c.metadata) ||
                avatarFrom(c.contact?.metadata);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void selectConversation(c.id)}
                    className={cn(
                      'flex w-full gap-3 border-b border-surface-border/60 px-4 py-3 text-left transition',
                      active ? 'bg-brand/10' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="relative">
                      <Avatar name={name} src={avatar} size="md" />
                      {group ? (
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface-raised p-0.5 text-emerald-400">
                          <Users className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-ink">{name}</p>
                        {c.lastMessageAt ? (
                          <span className="shrink-0 text-[10px] text-ink-faint">
                            {formatRelative(c.lastMessageAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-ink-muted">
                        {c.lastMessagePreview || 'Sem mensagens'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {group ? <Badge tone="brand">Grupo</Badge> : null}
                        {c.status ? (
                          <Badge tone={statusTone(c.status)}>
                            {whatsappStyle ? statusLabel(c.status) : c.status}
                          </Badge>
                        ) : null}
                        {(() => {
                          const sla = slaBadge(
                            typeof c.slaDueAt === 'string' ? c.slaDueAt : null,
                          );
                          return sla ? <Badge tone={sla.tone}>{sla.label}</Badge> : null;
                        })()}
                        {(c.unreadCount ?? 0) > 0 ? (
                          <Badge tone="warning">{c.unreadCount}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
