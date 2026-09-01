'use client';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { BrandLogo } from '@/components/brand/BrandLogo';
import {
  LayoutDashboard,
  Inbox,
  Contact2,
  Kanban,
  Building2,
  CalendarDays,
  CheckSquare,
  Workflow,
  Bot,
  BookOpen,
  Ticket,
  BarChart3,
  Plug,
  Radio,
  Settings,
  Briefcase,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  MessageCircle,
  Smartphone,
  Zap,
  Webhook,
  ScrollText,
  KeyRound,
  Users,
  Building,
  CreditCard,
  Layers,
  Tags,
  Bell,
  AlertTriangle,
  Clock,
  FileText,
  Package,
  Palette,
  Megaphone,
  Newspaper,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const whatsappNav = [
  { href: '/whatsapp/chat', label: 'Chat', icon: MessageCircle },
  { href: '/inbox', label: 'Caixa de entrada', icon: Inbox },
  { href: '/contacts', label: 'Contatos', icon: Contact2 },
  { href: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { href: '/whatsapp/instancias', label: 'Instâncias', icon: Smartphone },
  { href: '/whatsapp/kanban', label: 'Kanban', icon: Kanban },
  { href: '/whatsapp/agendamentos', label: 'Agendamentos', icon: CalendarDays },
  { href: '/whatsapp/fluxos', label: 'Fluxos', icon: Workflow },
  { href: '/whatsapp/respostas-rapidas', label: 'Respostas Rápidas', icon: Zap },
  { href: '/whatsapp/falhas', label: 'Fila de falhas', icon: AlertTriangle },
];

const integrationsNav = [
  { href: '/integrations/webhook', label: 'Webhook', icon: Webhook },
  { href: '/integrations/logs-webhook', label: 'Logs do Webhook', icon: ScrollText },
  { href: '/integrations/api', label: 'API', icon: KeyRound },
];

const settingsNav = [
  { href: '/settings/usuarios', label: 'Usuários', icon: Users },
  { href: '/settings/empresa', label: 'Perfil da Empresa', icon: Building },
  { href: '/settings/plano', label: 'Plano', icon: CreditCard },
  { href: '/settings/catalogo', label: 'Catálogo', icon: Package },
  { href: '/settings/marca', label: 'Marca', icon: Palette },
  { href: '/settings/setores', label: 'Setores', icon: Layers },
  { href: '/settings/tags', label: 'Etiquetas', icon: Tags },
  { href: '/settings/horario', label: 'Horário comercial', icon: Clock },
  { href: '/settings/templates', label: 'Templates WhatsApp', icon: FileText },
  { href: '/settings/notificacoes', label: 'Notificações', icon: Bell },
];

const platformNav = [
  { href: '/platform/overview', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/platform/signups', label: 'Aprovações', icon: CheckSquare },
  { href: '/platform/tenants', label: 'Empresas', icon: Building2 },
  { href: '/platform/plans', label: 'Planos', icon: Briefcase },
  { href: '/platform/billing', label: 'Faturação', icon: BarChart3 },
  { href: '/platform/usage', label: 'Utilização', icon: Radio },
  { href: '/platform/providers', label: 'Fornecedores', icon: Plug },
  { href: '/platform/ai', label: 'IA', icon: Bot },
  { href: '/platform/integrations', label: 'Integrações', icon: Workflow },
  { href: '/platform/feature-flags', label: 'Sinalizadores', icon: Sparkles },
  { href: '/platform/system-logs', label: 'Logs do sistema', icon: BookOpen },
  { href: '/platform/audit', label: 'Auditoria', icon: Ticket },
  { href: '/platform/infrastructure', label: 'Infraestrutura', icon: Settings },
];

type AppSidebarProps = {
  mode?: 'tenant' | 'platform';
  collapsed?: boolean;
  onToggle?: () => void;
};

export function AppSidebar({ mode = 'tenant', collapsed = false, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isPlatformUser = Boolean(user?.platformRole);
  const whatsappActive =
    pathname.startsWith('/whatsapp') ||
    pathname.startsWith('/inbox') ||
    pathname.startsWith('/contacts') ||
    pathname.startsWith('/campaigns');
  const integrationsActive = pathname.startsWith('/integrations');
  const settingsActive = pathname.startsWith('/settings');
  const [whatsappOpen, setWhatsappOpen] = useState(whatsappActive);
  const [integrationsOpen, setIntegrationsOpen] = useState(integrationsActive);
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  const [approvalsBadge, setApprovalsBadge] = useState(0);

  useEffect(() => {
    if (whatsappActive) setWhatsappOpen(true);
  }, [whatsappActive]);

  useEffect(() => {
    if (integrationsActive) setIntegrationsOpen(true);
  }, [integrationsActive]);

  useEffect(() => {
    if (settingsActive) setSettingsOpen(true);
  }, [settingsActive]);

  useEffect(() => {
    if (mode !== 'platform') return;
    let cancelled = false;
    (async () => {
      try {
        const [signups, changes] = await Promise.all([
          api.platformPendingSignups().catch(() => []),
          api.platformPendingPlanChanges().catch(() => []),
        ]);
        if (!cancelled) {
          setApprovalsBadge(
            (Array.isArray(signups) ? signups.length : 0) +
              (Array.isArray(changes) ? changes.length : 0),
          );
        }
      } catch {
        if (!cancelled) setApprovalsBadge(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-surface-border bg-surface/95 backdrop-blur-md transition-all',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-surface-border px-3">
        <Link
          href={mode === 'platform' ? '/platform/overview' : '/dashboard'}
          className="flex min-w-0 items-center gap-2 overflow-visible"
        >
          {collapsed ? (
            <BrandLogo variant="mark" className="h-8 w-8" priority />
          ) : (
            <BrandLogo variant="wordmark" className="h-10 w-auto max-w-[220px]" priority />
          )}
        </Link>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1.5 text-ink-faint hover:bg-white/5 hover:text-ink"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn('h-4 w-4 transition', collapsed && 'rotate-180')} />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {mode === 'tenant' ? (
          <ul className="mb-3 space-y-0.5">
            <li>
              <Link
                href="/dashboard"
                title="Painel"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                  pathname === '/dashboard' || pathname.startsWith('/dashboard/')
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                  collapsed && 'justify-center px-0',
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>Painel</span> : null}
              </Link>
            </li>
            <li>
              <Link
                href="/analytics"
                title="Análises"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                  pathname === '/analytics' || pathname.startsWith('/analytics/')
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                  collapsed && 'justify-center px-0',
                )}
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>Análises</span> : null}
              </Link>
            </li>
            <li>
              <Link
                href="/changelog"
                title="Novidades"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                  pathname === '/changelog' || pathname.startsWith('/changelog/')
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Newspaper className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>Novidades</span> : null}
              </Link>
            </li>
          </ul>
        ) : null}

        {mode === 'tenant' ? (
          <div className="mb-3">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setWhatsappOpen((o) => !o)}
                className={cn(
                  'mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition',
                  whatsappActive
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <span className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">WhatsApp</span>
                </span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition', whatsappOpen && 'rotate-180')}
                />
              </button>
            ) : (
              <Link
                href="/whatsapp/chat"
                title="WhatsApp"
                className={cn(
                  'mb-1 flex items-center justify-center rounded-lg py-2 transition',
                  whatsappActive
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <MessageCircle className="h-4 w-4" />
              </Link>
            )}

            {(whatsappOpen || collapsed) && (
              <ul className={cn('space-y-0.5', !collapsed && 'ml-2 border-l border-surface-border pl-2')}>
                {whatsappNav.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                          active
                            ? 'bg-brand/15 text-brand-light'
                            : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {mode === 'tenant' ? (
          <div className="mb-3">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setIntegrationsOpen((o) => !o)}
                className={cn(
                  'mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition',
                  integrationsActive
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <span className="flex items-center gap-3">
                  <Plug className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Integrações</span>
                </span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition', integrationsOpen && 'rotate-180')}
                />
              </button>
            ) : (
              <Link
                href="/integrations/webhook"
                title="Integrações"
                className={cn(
                  'mb-1 flex items-center justify-center rounded-lg py-2 transition',
                  integrationsActive
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <Plug className="h-4 w-4" />
              </Link>
            )}

            {(integrationsOpen || collapsed) && (
              <ul className={cn('space-y-0.5', !collapsed && 'ml-2 border-l border-surface-border pl-2')}>
                {integrationsNav.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                          active
                            ? 'bg-brand/15 text-brand-light'
                            : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {mode === 'tenant' ? (
          <div className="mb-3">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                className={cn(
                  'mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition',
                  settingsActive
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <span className="flex items-center gap-3">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Configurações</span>
                </span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition', settingsOpen && 'rotate-180')}
                />
              </button>
            ) : (
              <Link
                href="/settings/usuarios"
                title="Configurações"
                className={cn(
                  'mb-1 flex items-center justify-center rounded-lg py-2 transition',
                  settingsActive
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}

            {(settingsOpen || collapsed) && (
              <ul className={cn('space-y-0.5', !collapsed && 'ml-2 border-l border-surface-border pl-2')}>
                {settingsNav.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                          active
                            ? 'bg-brand/15 text-brand-light'
                            : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <ul className="space-y-0.5">
          {mode === 'platform'
            ? platformNav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const showBadge =
                  item.href === '/platform/signups' && approvalsBadge > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-brand/15 text-brand-light'
                          : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                        collapsed && 'justify-center px-0',
                      )}
                      title={item.label}
                    >
                      <span className="relative shrink-0">
                        <Icon className="h-4 w-4" />
                        {collapsed && showBadge ? (
                          <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-amber-400" />
                        ) : null}
                      </span>
                      {!collapsed ? (
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span>{item.label}</span>
                          {showBadge ? (
                            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200">
                              {approvalsBadge > 99 ? '99+' : approvalsBadge}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })
            : null}
        </ul>
      </nav>

      {mode === 'tenant' && isPlatformUser && !collapsed ? (
        <div className="border-t border-surface-border p-3">
          <Link
            href="/platform/overview"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-ink-muted hover:bg-white/5 hover:text-brand-light"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Admin da plataforma
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
