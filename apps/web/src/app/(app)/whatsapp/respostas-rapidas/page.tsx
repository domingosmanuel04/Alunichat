'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type QuickReply } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function WhatsAppQuickRepliesPage() {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('geral');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listQuickReplies());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar respostas');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!shortcut.trim() || !title.trim() || !body.trim()) {
      toast.error('Preencha atalho, título e mensagem');
      return;
    }
    setSaving(true);
    try {
      await api.createQuickReply({
        shortcut: shortcut.trim(),
        title: title.trim(),
        body: body.trim(),
        category: category.trim() || undefined,
      });
      toast.success('Resposta rápida criada');
      setShortcut('');
      setTitle('');
      setBody('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteQuickReply(id);
      toast.success('Removida');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  return (
    <>
      <AppTopbar
        title="WhatsApp · Respostas Rápidas"
        subtitle="Atalhos para o atendente no chat"
      />

      <div className="border-b border-surface-border px-5 py-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Input
            label="Atalho"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="ola"
          />
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Saudação"
          />
          <Input
            label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="geral"
          />
          <Button loading={saving} onClick={() => void create()}>
            Salvar
          </Button>
        </div>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-muted">Mensagem</span>
          <textarea
            className="min-h-[88px] w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-ink outline-none focus:border-brand/60"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Olá! Como posso ajudar?"
          />
        </label>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhuma resposta rápida cadastrada.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    /{item.shortcut} · {item.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{item.body}</p>
                  {item.category ? (
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-faint">
                      {item.category}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => void remove(item.id)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
