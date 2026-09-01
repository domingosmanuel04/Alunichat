'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { usePresence } from '@/hooks/usePresence';
import { useInboxStore } from '@/stores/inbox-store';
import {
  ArrowLeft,
  CalendarClock,
  MessageCircle,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type ChatThreadProps = {
  enableSchedule?: boolean;
  showWhatsAppEmpty?: boolean;
  emptyHint?: string;
  showBackOnMobile?: boolean;
};

function formatSlaCountdown(dueAt: string) {
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const diff = due - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const label =
    hrs > 0 ? `${hrs}h ${remMins}m` : `${Math.max(1, remMins || mins)}m`;
  return { overdue, label: overdue ? `SLA −${label}` : `SLA ${label}`, urgent: !overdue && mins < 10 };
}

const INTENT_LABEL: Record<string, string> = {
  sales: 'Vendas',
  support: 'Suporte',
  spam: 'Spam',
  other: 'Outro',
};

const SUGGEST_LABEL: Record<string, string> = {
  create_deal: 'Criar negócio',
  create_ticket: 'Abrir ticket',
  close: 'Encerrar conversa',
  follow_up: 'Fazer follow-up',
};

export function ChatThread({
  enableSchedule = false,
  showWhatsAppEmpty = false,
  emptyHint,
  showBackOnMobile = false,
}: ChatThreadProps) {
  const detail = useInboxStore((s) => s.detail);
  const selectedId = useInboxStore((s) => s.selectedId);
  const loadingDetail = useInboxStore((s) => s.loadingDetail);
  const sending = useInboxStore((s) => s.sending);
  const sendMessage = useInboxStore((s) => s.sendMessage);
  const clearSelection = useInboxStore((s) => s.clearSelection);
  const selectConversation = useInboxStore((s) => s.selectConversation);
  const [text, setText] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [applyingMacro, setApplyingMacro] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [quickReplies, setQuickReplies] = useState<
    { id: string; shortcut?: string; title?: string; body?: string }[]
  >([]);
  const [macros, setMacros] = useState<{ id: string; name: string }[]>([]);
  const [catalog, setCatalog] = useState<
    { name?: string; price?: number | string; description?: string }[]
  >([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [intent, setIntent] = useState<{ intent?: string; confidence?: number } | null>(
    null,
  );
  const [suggest, setSuggest] = useState<{
    suggestion?: string;
    reason?: string;
  } | null>(null);
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [slaTick, setSlaTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const presenceUsers = usePresence(selectedId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  useEffect(() => {
    void api
      .listQuickReplies()
      .then((rows) =>
        setQuickReplies(
          rows.map((r) => ({
            id: String(r.id),
            shortcut: String(r.shortcut || r.slug || ''),
            title: String(r.title || r.name || ''),
            body: String(r.body || r.content || ''),
          })),
        ),
      )
      .catch(() => setQuickReplies([]));
    void api
      .listMacros()
      .then((rows) =>
        setMacros(
          rows.map((r) => ({
            id: String(r.id),
            name: String(r.name || 'Macro'),
          })),
        ),
      )
      .catch(() => setMacros([]));
    void api
      .listCatalog()
      .then((res) => {
        const items = (res.items || []) as {
          name?: string;
          price?: number | string;
          description?: string;
        }[];
        setCatalog(items);
      })
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!detail?.slaDueAt) return;
    const id = setInterval(() => setSlaTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [detail?.slaDueAt]);

  useEffect(() => {
    setSummary(null);
    setIntent(null);
    setSuggest(null);
    setIsPrivate(false);
    if (!selectedId) return;
    let cancelled = false;
    void Promise.all([
      api.conversationSummary(selectedId).catch(() => null),
      api.conversationIntent(selectedId).catch(() => null),
      api.conversationSuggest(selectedId).catch(() => null),
    ]).then(([sum, intentRes, suggestRes]) => {
      if (cancelled) return;
      if (sum?.summary) setSummary(sum.summary);
      if (intentRes?.intent) {
        setIntent({ intent: intentRes.intent, confidence: intentRes.confidence });
      }
      if (suggestRes?.suggestion) {
        setSuggest({
          suggestion: suggestRes.suggestion,
          reason: suggestRes.reason,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const meta = (detail?.metadata || {}) as Record<string, unknown>;
    setAdminsOnly(meta.adminsOnlyReply === true);
  }, [detail?.metadata]);

  async function maybeExpandShortcut(value: string) {
    const match = value.trim().match(/^\/([a-zA-Z0-9_-]+)\s*$/);
    if (!match) return value;
    const key = match[1].toLowerCase();
    const found = quickReplies.find(
      (q) =>
        (q.shortcut || '').replace(/^\//, '').toLowerCase() === key ||
        (q.title || '').toLowerCase() === key,
    );
    if (found?.body) {
      toast.success(`Resposta rápida: ${found.title || found.shortcut}`);
      return found.body;
    }
    return value;
  }
  const isGroup = useMemo(() => {
    const meta = (detail?.metadata || detail?.contact?.metadata || {}) as Record<
      string,
      unknown
    >;
    if (meta.isGroup === true) return true;
    return Boolean(detail?.contact?.phone?.includes('@g.us'));
  }, [detail]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const content = await maybeExpandShortcut(text);
      const when =
        scheduleOpen && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined;
      if (scheduleOpen && scheduledAt) {
        const t = new Date(scheduledAt).getTime();
        if (Number.isNaN(t) || t <= Date.now()) {
          toast.error('Escolha uma data/hora futura para agendar');
          return;
        }
      }
      await sendMessage(content, { scheduledAt: when, isPrivate });
      setText('');
      setScheduleOpen(false);
      setScheduledAt('');
      toast.success(
        when
          ? 'Mensagem agendada'
          : isPrivate
            ? 'Nota interna enviada'
            : 'Mensagem enviada',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar');
    }
  }

  async function onAiDraft() {
    if (!selectedId) return;
    setDrafting(true);
    try {
      const res = await api.aiDraft(selectedId);
      const draft = res.draft?.trim();
      if (draft) {
        setText(draft);
        toast.success('Rascunho IA gerado');
      } else {
        toast.error('IA não devolveu texto');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no rascunho IA');
    } finally {
      setDrafting(false);
    }
  }

  async function onApplyMacro(macroId: string) {
    if (!selectedId || !macroId) return;
    setApplyingMacro(true);
    try {
      const res = await api.applyMacro(macroId, selectedId);
      if (res.replyBody) setText(res.replyBody);
      toast.success('Macro aplicada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao aplicar macro');
    } finally {
      setApplyingMacro(false);
    }
  }

  async function onReact(messageId: string, emoji: string) {
    try {
      await api.reactMessage(messageId, emoji);
      if (selectedId) await selectConversation(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao reagir');
    }
  }

  function insertCatalogItem(item: {
    name?: string;
    price?: number | string;
    description?: string;
  }) {
    const price =
      item.price != null && item.price !== ''
        ? ` — ${typeof item.price === 'number' ? `R$ ${item.price.toFixed(2)}` : item.price}`
        : '';
    const desc = item.description ? `\n${item.description}` : '';
    const block = `*${item.name || 'Produto'}*${price}${desc}`;
    setText((prev) => (prev ? `${prev}\n\n${block}` : block));
  }

  async function onToggleGroupPerms(checked: boolean) {
    if (!selectedId) return;
    try {
      await api.setGroupPermissions(selectedId, { adminsOnlyReply: checked });
      setAdminsOnly(checked);
      toast.success(
        checked
          ? 'Só admins podem responder no grupo'
          : 'Todos podem responder no grupo',
      );
      await selectConversation(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar permissões');
    }
  }

  if (!selectedId) {
    if (showWhatsAppEmpty) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-overlay text-ink-faint">
            <MessageCircle className="h-10 w-10" />
          </div>
          <p className="font-display text-lg font-semibold text-ink">
            Mantenha seu celular conectado
          </p>
          <p className="max-w-md text-sm text-ink-muted">
            {emptyHint ||
              'O WhatsApp conecta ao seu celular para sincronizar as mensagens. Selecione uma conversa ou grupo à esquerda.'}
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
        Selecione uma conversa
      </div>
    );
  }

  if (loadingDetail) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-20 w-2/3" />
        <Skeleton className="ml-auto h-16 w-1/2" />
      </div>
    );
  }

  const messages = detail?.messages ?? [];
  const title = detail?.subject || detail?.contact?.name || 'Conversa';
  const avatarSrc = (() => {
    const fromContact = (detail?.contact?.metadata as { avatarUrl?: string } | undefined)
      ?.avatarUrl;
    const fromConv = (detail?.metadata as { avatarUrl?: string } | undefined)?.avatarUrl;
    return fromContact || fromConv || null;
  })();
  const slaDueAt = detail?.slaDueAt ? String(detail.slaDueAt) : null;
  const slaInfo = slaDueAt ? formatSlaCountdown(slaDueAt) : null;
  void slaTick;

  return (
    <>
      <div className="flex h-14 items-center justify-between gap-3 border-b border-surface-border px-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {showBackOnMobile ? (
            <button
              type="button"
              onClick={() => clearSelection()}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink md:hidden"
              aria-label="Voltar à lista"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <Avatar name={title} src={avatarSrc} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-display text-sm font-semibold text-ink">{title}</p>
              {isGroup ? (
                <Badge tone="brand">
                  <Users className="mr-1 h-3 w-3" />
                  Grupo
                </Badge>
              ) : null}
              {slaInfo ? (
                <Badge tone={slaInfo.overdue ? 'danger' : slaInfo.urgent ? 'warning' : 'brand'}>
                  {slaInfo.label}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-ink-faint">
              {detail?.status || '—'}
              {presenceUsers.length > 0
                ? ` · Online: ${presenceUsers.map((u) => u.name).join(', ')}`
                : ''}
            </p>
          </div>
        </div>
        {isGroup ? (
          <label className="hidden shrink-0 items-center gap-2 text-xs text-ink-muted sm:flex">
            <input
              type="checkbox"
              checked={adminsOnly}
              onChange={(e) => void onToggleGroupPerms(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-surface-border"
            />
            Só admins
          </label>
        ) : null}
      </div>

      {(summary || intent) && (
        <div className="border-b border-surface-border bg-surface/60 px-4 py-2 text-xs text-ink-muted">
          {intent?.intent ? (
            <p>
              <span className="font-medium text-ink">Intenção:</span>{' '}
              {INTENT_LABEL[intent.intent] || intent.intent}
              {intent.confidence != null
                ? ` (${Math.round(intent.confidence * 100)}%)`
                : ''}
            </p>
          ) : null}
          {summary ? (
            <p className={cn(intent?.intent && 'mt-1')}>
              <span className="font-medium text-ink">Resumo:</span> {summary}
            </p>
          ) : null}
        </div>
      )}

      {suggest?.suggestion ? (
        <div className="border-b border-surface-border px-4 py-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand-light hover:bg-brand/20"
            title={suggest.reason || ''}
            onClick={() =>
              toast.info(suggest.reason || SUGGEST_LABEL[suggest.suggestion || ''] || '')
            }
          >
            <Sparkles className="h-3 w-3" />
            Próximo passo: {SUGGEST_LABEL[suggest.suggestion] || suggest.suggestion}
          </button>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">Nenhuma mensagem nesta conversa.</p>
        ) : (
          messages.map((m) => {
            const outbound = m.direction === 'OUTBOUND' || m.direction === 'INTERNAL';
            const body = m.content || m.body || '';
            const pending = (m.status || '').toUpperCase() === 'PENDING';
            const note = m.direction === 'INTERNAL' || m.isPrivate === true;
            return (
              <div
                key={m.id}
                className={cn('group flex', outbound ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                    note
                      ? 'rounded-br-md border border-amber-500/30 bg-amber-500/10 text-ink'
                      : outbound
                        ? pending
                          ? 'rounded-br-md border border-amber-500/40 bg-amber-500/15 text-ink'
                          : 'rounded-br-md bg-brand text-white'
                        : 'rounded-bl-md bg-surface-overlay text-ink',
                  )}
                >
                  {note ? (
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-amber-300">
                      Nota interna
                    </p>
                  ) : null}
                  {pending && !note ? (
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-amber-300">
                      Agendada
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{body}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {m.createdAt ? (
                      <p
                        className={cn(
                          'text-[10px]',
                          outbound && !pending && !note ? 'text-white/70' : 'text-ink-faint',
                        )}
                      >
                        {new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : (
                      <span />
                    )}
                    <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        className="rounded px-1 text-xs hover:bg-black/20"
                        onClick={() => void onReact(m.id, '👍')}
                        title="Curtir"
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className="rounded px-1 text-xs hover:bg-black/20"
                        onClick={() => void onReact(m.id, '❤️')}
                        title="Amar"
                      >
                        ❤️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-2 border-t border-surface-border p-4"
      >
        {enableSchedule && scheduleOpen ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2">
            <CalendarClock className="h-4 w-4 text-brand" />
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-9 flex-1 rounded-md border border-surface-border bg-surface-raised px-2 text-sm text-ink"
            />
            <button
              type="button"
              onClick={() => {
                setScheduleOpen(false);
                setScheduledAt('');
              }}
              className="rounded p-1 text-ink-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={drafting}
            onClick={() => void onAiDraft()}
            title="Gerar rascunho com IA"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Rascunho IA
          </Button>
          {macros.length > 0 ? (
            <select
              className="h-8 rounded-lg border border-surface-border bg-surface-raised px-2 text-xs text-ink"
              defaultValue=""
              disabled={applyingMacro}
              onChange={(e) => {
                const id = e.target.value;
                e.target.value = '';
                if (id) void onApplyMacro(id);
              }}
            >
              <option value="">Macros…</option>
              {macros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : null}
          {catalog.length > 0 ? (
            <select
              className="h-8 rounded-lg border border-surface-border bg-surface-raised px-2 text-xs text-ink"
              defaultValue=""
              onChange={(e) => {
                const idx = Number(e.target.value);
                e.target.value = '';
                if (!Number.isNaN(idx) && catalog[idx]) insertCatalogItem(catalog[idx]);
              }}
            >
              <option value="">Catálogo…</option>
              {catalog.map((item, idx) => (
                <option key={`${item.name}-${idx}`} value={idx}>
                  {item.name || `Produto ${idx + 1}`}
                </option>
              ))}
            </select>
          ) : null}
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-surface-border"
            />
            Nota privada
          </label>
        </div>
        {isPrivate ? (
          <p className="text-[11px] text-ink-faint">
            Use @nome para mencionar um colega na nota interna.
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          {enableSchedule ? (
            <Button
              type="button"
              variant={scheduleOpen ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setScheduleOpen((v) => !v)}
              title="Agendar envio"
            >
              <CalendarClock className="h-4 w-4" />
            </Button>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={
              isPrivate
                ? 'Nota interna… (use @nome)'
                : scheduleOpen
                  ? 'Mensagem a agendar…'
                  : 'Escreva uma mensagem… (use /atalho)'
            }
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-surface-border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Tab') {
                const expanded = quickReplies.find((q) => {
                  const sc = (q.shortcut || '').replace(/^\//, '').toLowerCase();
                  return text.trim().toLowerCase() === `/${sc}`;
                });
                if (expanded?.body) {
                  e.preventDefault();
                  setText(expanded.body);
                  toast.success(`Resposta rápida: ${expanded.title || expanded.shortcut}`);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onSubmit(e);
              }
            }}
          />
          <Button type="submit" loading={sending} disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  );
}
