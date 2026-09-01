'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Contact } from '@/lib/api';
import { downloadContactsPdf } from '@/lib/export-contacts-pdf';
import { downloadContactsCsv } from '@/lib/export-contacts-csv';
import { formatPhoneDisplay } from '@/lib/phone-country';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Pencil, RefreshCw, Search, Shield, UserPlus } from 'lucide-react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [lgpdBusy, setLgpdBusy] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listContacts({
        search: q?.trim() || undefined,
        page: 1,
        pageSize: 2000,
      });
      setContacts(list);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar contatos');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const phoneFmt = formatPhoneDisplay(c.phone);
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        phoneFmt.label.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    });
  }, [contacts, search]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const c of filtered) next.delete(c.id);
      } else {
        for (const c of filtered) next.add(c.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSync() {
    setSyncing(true);
    try {
      const result = await api.syncWhatsAppContacts();
      toast.success(
        `Sincronizado: ${result.upserted} contacto(s)` +
          (result.resolvedLids
            ? ` · ${result.resolvedLids} número(s) resolvidos`
            : '') +
          (result.pendingNumbers
            ? ` · ${result.pendingNumbers} a aguardar número`
            : ''),
      );
      await load(search);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao sincronizar WhatsApp',
      );
    } finally {
      setSyncing(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createContact({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: 'manual',
      });
      toast.success('Contato criado');
      setCreateOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      await load(search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c: Contact) {
    setEditId(c.id);
    setEditName(c.name || '');
    setEditOpen(true);
  }

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    if (!editId || !editName.trim()) return;
    setEditSaving(true);
    try {
      await api.updateContact(editId, { name: editName.trim() });
      toast.success('Nome atualizado');
      setEditOpen(false);
      setEditId(null);
      await load(search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar');
    } finally {
      setEditSaving(false);
    }
  }

  function onExportPdf() {
    const rows = filtered
      .filter((c) => selected.has(c.id))
      .map((c) => {
        const phoneFmt = formatPhoneDisplay(c.phone);
        return {
          name: c.name || 'Sem nome',
          country: phoneFmt.country
            ? `${phoneFmt.country.iso} (+${phoneFmt.country.dial})`
            : '—',
          phone: phoneFmt.e164,
          source: c.source === 'whatsapp' ? 'WhatsApp' : c.source || 'Manual',
        };
      });

    if (rows.length === 0) {
      toast.error('Selecione pelo menos um contato para exportar');
      return;
    }

    downloadContactsPdf(
      rows,
      `contatos-alurichat-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    toast.success(`PDF com ${rows.length} contato(s) descarregado`);
  }

  function onExportCsv() {
    const rows = filtered
      .filter((c) => selected.has(c.id))
      .map((c) => {
        const phoneFmt = formatPhoneDisplay(c.phone);
        return {
          name: c.name || 'Sem nome',
          country: phoneFmt.country
            ? `${phoneFmt.country.iso} (+${phoneFmt.country.dial})`
            : '—',
          phone: phoneFmt.e164,
          source: c.source === 'whatsapp' ? 'WhatsApp' : c.source || 'Manual',
          email: c.email || '',
        };
      });

    if (rows.length === 0) {
      toast.error('Selecione pelo menos um contato para exportar');
      return;
    }

    downloadContactsCsv(
      rows,
      `contatos-alurichat-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(`CSV com ${rows.length} contato(s) descarregado`);
  }

  const selectedOneId =
    selected.size === 1 ? Array.from(selected)[0] : null;

  async function onLgpdExport() {
    if (!selectedOneId) {
      toast.error('Selecione exatamente um contacto para exportação LGPD');
      return;
    }
    setLgpdBusy(true);
    try {
      const data = await api.exportContactLgpd(selectedOneId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lgpd-${selectedOneId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportação LGPD descarregada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na exportação LGPD');
    } finally {
      setLgpdBusy(false);
    }
  }

  async function onLgpdErase() {
    if (!selectedOneId) {
      toast.error('Selecione exatamente um contacto para anonimizar');
      return;
    }
    if (!confirm('Anonimizar este contacto (LGPD)? Esta ação não pode ser desfeita.')) {
      return;
    }
    setLgpdBusy(true);
    try {
      await api.eraseContactLgpd(selectedOneId);
      toast.success('Contacto anonimizado');
      await load(search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao anonimizar');
    } finally {
      setLgpdBusy(false);
    }
  }

  async function onOptOut() {
    if (!selectedOneId) {
      toast.error('Selecione exatamente um contacto para opt-out');
      return;
    }
    setLgpdBusy(true);
    try {
      await api.optOutContact(selectedOneId, true);
      toast.success('Opt-out de marketing registado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no opt-out');
    } finally {
      setLgpdBusy(false);
    }
  }

  return (
    <>
      <AppTopbar
        title="Contatos"
        subtitle="Contactos do WhatsApp conectado — nome, número e país"
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou número…"
            className="h-9 w-full rounded-lg border border-surface-border bg-surface-overlay pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none"
          />
        </div>
        <p className="text-sm text-ink-muted">
          {filtered.length} contato{filtered.length === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selecionado(s)` : ''}
        </p>
        <Button size="sm" variant="secondary" loading={syncing} onClick={onSync}>
          <RefreshCw className="h-3.5 w-3.5" />
          Sincronizar WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selected.size === 0}
          onClick={onExportPdf}
        >
          <Download className="h-3.5 w-3.5" />
          Exportar PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selected.size === 0}
          onClick={onExportCsv}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedOneId || lgpdBusy}
          loading={lgpdBusy}
          onClick={() => void onLgpdExport()}
          title="Exportação LGPD do contacto selecionado"
        >
          <Shield className="h-3.5 w-3.5" />
          LGPD exportar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedOneId || lgpdBusy}
          onClick={() => void onOptOut()}
        >
          Opt-out
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={!selectedOneId || lgpdBusy}
          onClick={() => void onLgpdErase()}
        >
          LGPD apagar
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Novo contato
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            <p>Nenhum contato encontrado.</p>
            <p className="mt-1 text-ink-faint">
              Conecte uma instância WhatsApp e clique em «Sincronizar WhatsApp».
            </p>
            <Button className="mt-4" size="sm" loading={syncing} onClick={onSync}>
              Sincronizar WhatsApp
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Selecionar todos"
                      className="h-4 w-4 rounded border-surface-border"
                    />
                  </th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">País</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const phoneFmt = formatPhoneDisplay(c.phone);
                  const meta = (c.metadata || {}) as Record<string, unknown>;
                  const pending =
                    phoneFmt.pending || meta.pendingNumber === true;
                  const sourceLabel =
                    c.source === 'whatsapp'
                      ? 'WhatsApp'
                      : c.source === 'manual'
                        ? 'Manual'
                        : c.source || '—';
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-surface-border hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Selecionar ${c.name || c.phone}`}
                          className="h-4 w-4 rounded border-surface-border"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {c.name || (
                          <span className="text-ink-faint">Sem nome</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {phoneFmt.country ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-base leading-none">
                              {phoneFmt.country.flag}
                            </span>
                            <span>
                              {phoneFmt.country.name}{' '}
                              <span className="text-ink-faint">
                                (+{phoneFmt.country.dial})
                              </span>
                            </span>
                          </span>
                        ) : pending ? (
                          <span className="text-xs text-amber-300/90">WhatsApp</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-ink-muted">
                        {pending ? (
                          <span className="text-xs text-amber-200/90">
                            Número a sincronizar
                          </span>
                        ) : (
                          phoneFmt.e164
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            c.source === 'whatsapp'
                              ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300'
                              : 'rounded-md bg-white/5 px-2 py-0.5 text-xs text-ink-muted'
                          }
                        >
                          {sourceLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(c)}
                          title="Editar nome"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Nome
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo contato"
      >
        <form onSubmit={onCreate} className="space-y-3">
          <Input
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Maria Silva"
          />
          <Input
            label="Número (com código do país)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ex.: 244900000000"
          />
          <Input
            label="E-mail (opcional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar nome do contato"
      >
        <form onSubmit={onSaveName} className="space-y-3">
          <Input
            label="Nome"
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nome a mostrar"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={editSaving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
