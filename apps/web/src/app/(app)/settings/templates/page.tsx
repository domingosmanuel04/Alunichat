'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type TemplateItem = {
  id?: string;
  name?: string;
  body?: string;
  language?: string;
  category?: string;
};

export default function SettingsTemplatesPage() {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [language, setLanguage] = useState('pt');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.listWhatsappTemplates()) as TemplateItem[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar templates');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await api.saveWhatsappTemplates({
        name: name.trim(),
        body: body.trim(),
        language: language.trim() || 'pt',
      });
      toast.success('Template criado');
      setOpen(false);
      setName('');
      setBody('');
      setLanguage('pt');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remover este template?')) return;
    try {
      await api.deleteWhatsappTemplate(id);
      toast.success('Template removido');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  return (
    <>
      <AppTopbar
        title="Templates WhatsApp"
        subtitle="Modelos de mensagem (nome, corpo, idioma)"
      />
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
        <p className="text-sm text-ink-muted">{items.length} template(s)</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Novo template
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Ainda não há templates.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((t) => (
              <li
                key={String(t.id || t.name)}
                className="flex items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{t.name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">
                    {t.body}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Idioma: {t.language || 'pt'}
                    {t.category ? ` · ${t.category}` : ''}
                  </p>
                </div>
                {t.id ? (
                  <button
                    type="button"
                    onClick={() => void onRemove(String(t.id))}
                    className="rounded p-2 text-ink-faint hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Novo template">
        <form onSubmit={onCreate} className="space-y-3">
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="boas_vindas"
          />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Corpo
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-ink"
              placeholder="Olá {{nome}}, …"
            />
          </div>
          <Input
            label="Idioma"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="pt"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
