'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type DashboardMetrics } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function metric(value: unknown, fallback = '—') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  return String(value);
}

function normalizeDashboard(raw: DashboardMetrics) {
  return {
    openConversations: raw.openConversations ?? raw.conversations?.open,
    pendingConversations: raw.pendingConversations,
    newContacts: raw.newContacts ?? (typeof raw.contacts === 'number' ? raw.contacts : undefined),
    openDeals: raw.openDeals ?? raw.deals?.open,
    wonDeals: raw.wonDeals ?? raw.deals?.won,
    ticketsOpen: raw.ticketsOpen,
    messagesToday: raw.messagesToday,
    aiHandledPercent: raw.aiHandledPercent,
    greeting: raw.greeting,
    insight: raw.insight,
  };
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<ReturnType<typeof normalizeDashboard> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState({
    channel: false,
    contact: false,
    conversation: false,
  });
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    try {
      setOnboardingSkipped(localStorage.getItem('onboarding_skipped') === '1');
    } catch {
      setOnboardingSkipped(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [dash, channels, contacts, conversations] = await Promise.all([
          api.getDashboard(),
          api.listChannels().catch(() => []),
          api.listContacts({ pageSize: 1 }).catch(() => []),
          api.listConversations({ pageSize: 1 }).catch(() => []),
        ]);
        if (!cancelled) {
          setData(normalizeDashboard(dash));
          setOnboarding({
            channel: channels.length > 0,
            contact: contacts.length > 0,
            conversation: conversations.length > 0,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'equipe';
  const greeting = data?.greeting || `Olá, ${firstName}`;
  const insight =
    data?.insight ||
    (error
      ? 'Não foi possível carregar insights agora.'
      : 'Acompanhe o pulso da operação em tempo real.');

  const cards = [
    { label: 'Conversas abertas', value: metric(data?.openConversations) },
    { label: 'Pendentes', value: metric(data?.pendingConversations) },
    { label: 'Contatos', value: metric(data?.newContacts) },
    { label: 'Negócios abertos', value: metric(data?.openDeals) },
    { label: 'Negócios ganhos', value: metric(data?.wonDeals) },
    { label: 'Tickets abertos', value: metric(data?.ticketsOpen) },
    { label: 'Mensagens hoje', value: metric(data?.messagesToday) },
    {
      label: 'IA tratou',
      value:
        typeof data?.aiHandledPercent === 'number'
          ? `${data.aiHandledPercent}%`
          : metric(data?.aiHandledPercent),
    },
  ];

  const steps = [
    {
      done: onboarding.channel,
      label: 'Ligar uma instância WhatsApp',
      href: '/whatsapp/instancias',
    },
    {
      done: onboarding.contact,
      label: 'Ter pelo menos 1 contato',
      href: '/contacts',
    },
    {
      done: onboarding.conversation,
      label: 'Abrir o Chat e sincronizar conversas',
      href: '/whatsapp/chat',
    },
  ];
  const completedSteps = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedSteps / 3) * 100);
  const showOnboarding = !onboardingSkipped && steps.some((s) => !s.done);

  function skipOnboarding() {
    try {
      localStorage.setItem('onboarding_skipped', '1');
    } catch {
      // ignore
    }
    setOnboardingSkipped(true);
  }

  return (
    <>
      <AppTopbar title="Painel" subtitle="Visão operacional" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-semibold text-ink">{greeting}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{insight}</p>
        </div>

        {showOnboarding ? (
          <div className="mb-6 rounded-xl border border-brand/30 bg-brand/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">Começar em 3 passos</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-ink-muted">{progressPct}%</span>
                <button
                  type="button"
                  onClick={skipOnboarding}
                  className="text-xs text-ink-faint hover:text-ink"
                >
                  Ignorar
                </button>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <ul className="mt-3 space-y-2">
              {steps.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
                  >
                    {s.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-ink-faint" />
                    )}
                    <span className={s.done ? 'line-through opacity-60' : ''}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardDescription>{c.label}</CardDescription>
                <CardTitle className="mt-2 text-2xl tabular-nums">{c.value}</CardTitle>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
