'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Contact2,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings,
  Smartphone,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const LINKS = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard, keywords: 'dashboard home' },
  { href: '/whatsapp/chat', label: 'Chat WhatsApp', icon: MessageCircle, keywords: 'inbox conversas' },
  { href: '/inbox', label: 'Caixa de entrada', icon: MessageCircle, keywords: 'inbox' },
  { href: '/contacts', label: 'Contatos', icon: Contact2, keywords: 'contactos clientes' },
  { href: '/whatsapp/instancias', label: 'Instâncias', icon: Smartphone, keywords: 'whatsapp canal' },
  { href: '/settings/usuarios', label: 'Usuários', icon: Settings, keywords: 'equipa settings' },
  { href: '/settings/plano', label: 'Plano', icon: Settings, keywords: 'billing subscrição' },
  { href: '/settings/notificacoes', label: 'Notificações', icon: Settings, keywords: 'som alerta' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name?: string; phone?: string }[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    void api.listContacts({ pageSize: 30 }).then((rows) => {
      setContacts(
        rows.map((c) => ({
          id: String(c.id),
          name: String(c.name || ''),
          phone: String(c.phone || ''),
        })),
      );
    }).catch(() => setContacts([]));
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const links = LINKS.filter(
      (l) =>
        !term ||
        l.label.toLowerCase().includes(term) ||
        l.keywords.includes(term),
    );
    const people = contacts.filter(
      (c) =>
        term &&
        (`${c.name} ${c.phone}`.toLowerCase().includes(term)),
    );
    return { links, people };
  }, [q, contacts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl">
        <div className="flex items-center gap-2 border-b border-surface-border px-4">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar páginas, contatos…"
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-white/10 px-1.5 text-[10px] text-ink-faint">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-auto p-2">
          {filtered.links.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-white/5',
                  )}
                  onClick={() => {
                    setOpen(false);
                    router.push(l.href);
                  }}
                >
                  <Icon className="h-4 w-4 text-brand-light" />
                  {l.label}
                </button>
              </li>
            );
          })}
          {filtered.people.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-white/5"
                onClick={() => {
                  setOpen(false);
                  router.push('/contacts');
                }}
              >
                <Contact2 className="h-4 w-4 text-emerald-400" />
                <span className="truncate">
                  {c.name || c.phone || 'Contato'}{' '}
                  <span className="text-ink-faint">{c.phone}</span>
                </span>
              </button>
            </li>
          ))}
          {filtered.links.length === 0 && filtered.people.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">Sem resultados</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
