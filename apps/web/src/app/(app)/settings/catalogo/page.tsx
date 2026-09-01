'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';

type CatalogProduct = {
  id: string;
  name: string;
  price?: number | string;
  description?: string;
  sku?: string;
};

function asProducts(items: unknown[]): CatalogProduct[] {
  return items.map((raw, idx) => {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: String(o.id || `p-${idx}`),
      name: String(o.name || 'Produto'),
      price: (o.price as number | string | undefined) ?? '',
      description: String(o.description || ''),
      sku: String(o.sku || ''),
    };
  });
}

export default function SettingsCatalogoPage() {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listCatalog();
      setItems(asProducts(res.items || []));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar catálogo');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditId(null);
    setName('');
    setPrice('');
    setDescription('');
    setSku('');
    setOpen(true);
  }

  function openEdit(p: CatalogProduct) {
    setEditId(p.id);
    setName(p.name);
    setPrice(p.price != null ? String(p.price) : '');
    setDescription(p.description || '');
    setSku(p.sku || '');
    setOpen(true);
  }

  async function persist(next: CatalogProduct[]) {
    const payload = next.map(({ id, name: n, price: pr, description: d, sku: s }) => ({
      id,
      name: n,
      price: pr === '' || pr == null ? undefined : Number.isFinite(Number(pr)) ? Number(pr) : pr,
      description: d || undefined,
      sku: s || undefined,
    }));
    await api.saveCatalog(payload as Record<string, unknown>[]);
    setItems(asProducts(payload as unknown[]));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const product: CatalogProduct = {
        id: editId || `p-${Date.now().toString(36)}`,
        name: name.trim(),
        price: price.trim() || '',
        description: description.trim(),
        sku: sku.trim(),
      };
      const next = editId
        ? items.map((p) => (p.id === editId ? product : p))
        : [...items, product];
      await persist(next);
      toast.success(editId ? 'Produto atualizado' : 'Produto adicionado');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remover este produto do catálogo?')) return;
    try {
      await persist(items.filter((p) => p.id !== id));
      toast.success('Produto removido');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  return (
    <>
      <AppTopbar title="Catálogo" subtitle="Produtos para inserir nas conversas" />
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
        <p className="text-sm text-ink-muted">{items.length} produto(s)</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Novo produto
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhum produto no catálogo.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-faint">
                    {p.price !== '' && p.price != null
                      ? typeof p.price === 'number'
                        ? `R$ ${p.price.toFixed(2)}`
                        : p.price
                      : 'Sem preço'}
                    {p.sku ? ` · SKU ${p.sku}` : ''}
                  </p>
                  {p.description ? (
                    <p className="mt-1 text-xs text-ink-muted">{p.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void onRemove(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Editar produto' : 'Novo produto'}
      >
        <form onSubmit={onSave} className="space-y-3">
          <Input
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Preço"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex.: 29.90"
          />
          <Input
            label="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
          <label className="block text-sm text-ink-muted">
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-ink"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
