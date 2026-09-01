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

type Sector = {
  id: string;
  name?: string;
  description?: string | null;
  members?: unknown[];
  [key: string]: unknown;
};

export default function SettingsSetoresPage() {
  const [items, setItems] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.listTeams()) as Sector[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar setores');
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
      await api.createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Setor criado');
      setOpen(false);
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remover este setor?')) return;
    try {
      await api.deleteTeam(id);
      toast.success('Setor removido');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  return (
    <>
      <AppTopbar
        title="Setores"
        subtitle="Equipas e filas para organizar atendimento"
      />
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
        <p className="text-sm text-ink-muted">{items.length} setor(es)</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Novo setor
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhum setor. Crie o primeiro (ex.: Comercial, Suporte).
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Membros</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-medium text-ink">{s.name || '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.description || '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {Array.isArray(s.members) ? s.members.length : 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => void onRemove(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo setor">
        <form onSubmit={onCreate} className="space-y-3">
          <Input
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Comercial"
          />
          <Input
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
