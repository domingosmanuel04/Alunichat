'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';

type Membership = {
  id: string;
  role?: string;
  status?: string;
  user?: { id?: string; name?: string; email?: string };
  [key: string]: unknown;
};

/** UI role → API TenantRole */
const ROLE_OPTIONS = [
  { value: 'AGENT', label: 'Operador (User)' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'OWNER', label: 'Owner' },
] as const;

function roleLabel(role?: string) {
  const r = (role || '').toUpperCase();
  if (r === 'AGENT' || r === 'USER') return 'Operador';
  if (r === 'ADMIN') return 'Admin';
  if (r === 'SUPERVISOR') return 'Supervisor';
  if (r === 'VIEWER') return 'Viewer';
  if (r === 'OWNER') return 'Owner';
  return role || '—';
}

export default function SettingsUsuariosPage() {
  const [items, setItems] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('—');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENT');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, tenant] = await Promise.all([
        api.listUsers(),
        api.getSettings().catch(() => null),
      ]);
      setItems(users as Membership[]);
      if (tenant?.name) setCompanyName(String(tenant.name));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar usuários');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName('');
    setEmail('');
    setRole('AGENT');
    setPassword('');
    setShowPassword(false);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(m: Membership) {
    setEditing(m);
    setName(m.user?.name || '');
    setEmail(m.user?.email || '');
    setRole((m.role || 'AGENT').toUpperCase());
    setPassword('');
    setShowPassword(false);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }
    if (!editing && password.trim() && password.trim().length < 8) {
      toast.error('Senha deve ter pelo menos 8 caracteres');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.updateUser(editing.id, { role });
        toast.success('Usuário atualizado');
      } else {
        if (!password.trim()) {
          toast.error('Informe a senha');
          setSaving(false);
          return;
        }
        await api.inviteUser({
          name: name.trim(),
          email: email.trim(),
          role,
          password: password.trim(),
        });
        toast.success('Usuário criado');
      }
      setOpen(false);
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string, label: string) {
    if (!confirm(`Excluir o usuário "${label}"?`)) return;
    try {
      await api.removeUser(id);
      toast.success('Usuário removido');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  return (
    <>
      <AppTopbar title="Usuários" subtitle="Gestão de acessos da sua empresa" />

      <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
        <h2 className="text-base font-semibold text-ink">
          Usuários ({items.length})
        </h2>
        <Button
          className="bg-emerald-600 hover:bg-emerald-500"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Nenhum usuário. Crie o primeiro com «Novo Usuário».
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-medium text-ink">
                      {m.user?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {roleLabel(m.role)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Excluir"
                          className="text-red-400 hover:text-red-300"
                          onClick={() =>
                            void onRemove(m.id, m.user?.name || m.user?.email || 'usuário')
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title={editing ? 'Editar Usuário' : 'Criar Usuário'}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            disabled={Boolean(editing)}
          />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@email.com"
            disabled={Boolean(editing)}
          />
          {!editing ? (
            <label className="flex w-full flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-muted">Senha</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 pr-10 text-ink outline-none transition placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>
          ) : null}
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <div>
            <Input label="Empresa" value={companyName} disabled />
            <p className="mt-1.5 text-xs text-ink-faint">
              Usuários criados serão automaticamente vinculados à sua empresa
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
