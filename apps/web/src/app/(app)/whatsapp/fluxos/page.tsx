'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Workflow } from '@/lib/api';
import {
  commandFromConfig,
  createEmptyFlowDefinition,
  normalizeCommand,
} from '@/lib/whatsapp-flow';
import { GitBranch, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export default function WhatsAppFlowsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await api.listAutomations();
      const list = Array.isArray(all) ? all : [];
      const flows = list.filter((w) => {
        const version = Array.isArray(w.versions) ? w.versions[0] : undefined;
        const def = (version?.definition || {}) as { kind?: string };
        return (
          w.triggerType === 'whatsapp.command' ||
          def?.kind === 'whatsapp_chat_flow'
        );
      });
      setItems(flows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar fluxos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hintCommand = useMemo(() => {
    const c = normalizeCommand(command) || 'comando';
    return `\\${c}`;
  }, [command]);

  function openCreate() {
    setName('');
    setCommand('');
    setModalOpen(true);
  }

  async function create() {
    if (!name.trim()) {
      toast.error('Informe o nome do fluxo');
      return;
    }
    const cmd = normalizeCommand(command);
    if (!cmd) {
      toast.error('Informe o comando');
      return;
    }
    setSaving(true);
    try {
      const wf = await api.createWorkflow({
        name: name.trim(),
        triggerType: 'whatsapp.command',
        description: `Comando \\${cmd}`,
        triggerConfig: { command: cmd },
        definition: createEmptyFlowDefinition(),
      });
      toast.success('Fluxo criado');
      setModalOpen(false);
      router.push(`/whatsapp/fluxos/${wf.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar fluxo');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Excluir o fluxo "${label}"?`)) return;
    setBusyId(id);
    try {
      await api.deleteWorkflow(id);
      toast.success('Fluxo removido');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AppTopbar
        title="WhatsApp · Fluxos"
        subtitle="Sequências automáticas disparadas por comando no chat"
      />

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Fluxos</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              Crie sequências de mensagens (texto, mídia, áudio, atrasos e
              &apos;digitando&apos;) para automatizar conversas.
            </p>
          </div>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-500"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Criar fluxo
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2 rounded-xl border border-surface-border p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center">
            <GitBranch className="mx-auto h-10 w-10 text-ink-faint" />
            <p className="mt-3 text-sm text-ink-muted">Nenhum fluxo ainda.</p>
            <Button
              className="mt-4 bg-emerald-600 hover:bg-emerald-500"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Criar fluxo
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-raised/30">
            <ul>
              {items.map((wf, idx) => {
                const cmd = commandFromConfig(
                  wf.triggerConfig as Record<string, unknown> | null,
                );
                return (
                  <li
                    key={wf.id}
                    className={
                      idx === 0
                        ? ''
                        : 'border-t border-surface-border'
                    }
                  >
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => router.push(`/whatsapp/fluxos/${wf.id}`)}
                      >
                        <p className="truncate text-base font-semibold text-ink">
                          {wf.name}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          Comando:{' '}
                          <span className="font-medium text-emerald-400">
                            {`\\${cmd || '—'}`}
                          </span>
                        </p>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Editar"
                          className="rounded-lg p-2 text-ink-muted hover:bg-white/5 hover:text-ink"
                          onClick={() => router.push(`/whatsapp/fluxos/${wf.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          disabled={busyId === wf.id}
                          className="rounded-lg p-2 text-red-400/80 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                          onClick={() => void remove(wf.id, wf.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Criar fluxo"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nome do fluxo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Boas-vindas"
          />
          <div>
            <Input
              label="Comando (sem a barra invertida)"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="ex: boasvindas"
            />
            <p className="mt-2 text-xs text-ink-muted">
              No chat use:{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-ink">
                {hintCommand}
              </code>
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              loading={saving}
              onClick={() => void create()}
            >
              Criar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
