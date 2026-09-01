'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

type TagItem = {
  id: string;
  name?: string;
  color?: string;
  [key: string]: unknown;
};

export default function SettingsTagsPage() {
  const [items, setItems] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#14b8a6');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.listTags()) as TagItem[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar tags');
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
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createTag({ name: name.trim(), color });
      toast.success('Tag criada');
      setOpen(false);
      setName('');
      setColor('#14b8a6');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remover esta tag?')) return;
    try {
      await api.deleteTag(id);
      toast.success('Tag removida');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  return (
    <>
      <AppTopbar title="Etiquetas" subtitle="Etiquetas para organizar contatos e conversas" />
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
        <p className="text-sm text-ink-muted">{items.length} tag(s)</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nova tag
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhuma tag.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised/50 px-3 py-2 text-sm"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: t.color || '#14b8a6' }}
                />
                <span className="text-ink">{t.name}</span>
                <button
                  type="button"
                  className="text-ink-faint hover:text-red-300"
                  onClick={() => void onRemove(t.id)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova tag">
        <form onSubmit={onCreate} className="space-y-3">
          <Input
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: VIP"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-muted">Cor</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-20 cursor-pointer rounded border border-surface-border bg-transparent"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
