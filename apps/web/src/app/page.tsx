'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { HeroVideo } from '@/components/landing/HeroVideo';
import { cn } from '@/lib/utils';
import {
  Bot,
  Check,
  ChevronDown,
  LogIn,
  MessageCircle,
  UserPlus,
  Workflow,
  Zap,
  Shield,
  BarChart3,
  Users,
  Clock3,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const navLinks = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
];

const resources = [
  {
    icon: MessageCircle,
    title: 'WhatsApp nativo',
    text: 'Instâncias conectadas, chats, grupos e envio em tempo real numa operação única.',
  },
  {
    icon: Bot,
    title: 'IA no atendimento',
    text: 'Respostas inteligentes, triagem automática e handoff para humanos no momento certo.',
  },
  {
    icon: Workflow,
    title: 'Fluxos e automações',
    text: 'Sequências visuais, agendamentos e campanhas que trabalham enquanto a equipa foca em vender.',
  },
  {
    icon: BarChart3,
    title: 'CRM e analytics',
    text: 'Contactos, funis e métricas para perceber o que converte e o que precisa de atenção.',
  },
];

const benefits = [
  {
    icon: Zap,
    title: 'Resposta mais rápida',
    text: 'Filas claras, respostas rápidas e automações que cortam o tempo de espera.',
  },
  {
    icon: Users,
    title: 'Equipa alinhada',
    text: 'Inbox partilhado, contexto do contacto e histórico num só lugar.',
  },
  {
    icon: Shield,
    title: 'Operação sob controlo',
    text: 'Multi-tenant, permissões e canais isolados para cada empresa.',
  },
  {
    icon: Clock3,
    title: 'Vendas 24/7',
    text: 'Agentes e fluxos que não dormem — o lead encontra resposta a qualquer hora.',
  },
];

const faqs = [
  {
    q: 'Como começo a usar o Alurichat?',
    a: 'Crie a conta, entre no workspace, ligue uma instância WhatsApp e sincronize conversas. Em minutos já pode atender, automatizar e acompanhar contactos.',
  },
  {
    q: 'Funciona com WhatsApp Business?',
    a: 'Sim. Liga a instância, escaneia o QR e passa a enviar e receber mensagens, áudios, imagens e documentos diretamente na plataforma.',
  },
  {
    q: 'Posso automatizar o atendimento?',
    a: 'Pode. Monte fluxos com texto, mídia, atrasos e estados de digitação; combine com respostas rápidas e agendamentos.',
  },
  {
    q: 'A minha operação fica isolada?',
    a: 'Cada tenant tem dados, canais e permissões próprios. A arquitetura SaaS multi-empresa foi pensada para isolamento e escala.',
  },
  {
    q: 'Posso mudar de plano depois?',
    a: 'Sim. Começa no plano que faz sentido hoje e sobe quando a equipa e o volume crescerem — sem recomeçar do zero.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: 'Grátis*',
    period: null as string | null,
    hint: 'Para validar a operação',
    features: ['1 instância WhatsApp', 'Inbox e contactos', 'Respostas rápidas', 'Suporte por e-mail'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '49.000 Kz',
    period: '/mês',
    hint: 'Para equipas que vendem',
    features: [
      'Até 3 instâncias',
      'Fluxos e agendamentos',
      'CRM e kanban',
      'Analytics essenciais',
      'Prioridade no suporte',
    ],
    highlight: true,
  },
  {
    name: 'Business',
    price: '129.000 Kz',
    period: '/mês',
    hint: 'Para operações em escala',
    features: [
      'Instâncias ilimitadas*',
      'IA e automações avançadas',
      'Multi-equipa e permissões',
      'API e webhooks',
      'Onboarding dedicado',
    ],
    highlight: false,
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-surface text-ink">
      <div className="pointer-events-none fixed inset-0 bg-hero-glow" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(10,47,107,0.05) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black, transparent)',
        }}
      />

      {/* Nav */}
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-white/5 bg-surface/80 backdrop-blur-xl'
            : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="shrink-0">
            <BrandLogo variant="wordmark" className="h-11 w-auto max-w-[240px]" priority />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/login"
              className="group inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-ink-muted transition hover:bg-white/5 hover:text-ink"
            >
              <LogIn className="h-4 w-4 text-brand-cyan transition group-hover:text-brand-light" />
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              <UserPlus className="h-4 w-4" />
              Criar conta
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-white/5 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/5 bg-surface/95 px-5 py-4 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-white/5 hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink hover:bg-white/5"
              >
                <LogIn className="h-4 w-4 text-brand-cyan" />
                Entrar
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white"
              >
                <UserPlus className="h-4 w-4" />
                Criar conta
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero — full-bleed animated video */}
      <section className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden">
        <div className="absolute inset-0 bg-[#060d18]">
          <HeroVideo />
        </div>
        {/* Readability scrim — soft, not a flat panel */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#060d18]/95 via-[#060d18]/55 to-[#060d18]/20"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#060d18] via-transparent to-[#060d18]/40"
        />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-5 py-16 sm:px-6 lg:py-20">
          <div className="max-w-3xl animate-fade-up">
            <p className="bg-brand-gradient bg-clip-text font-display text-5xl font-semibold tracking-tight text-transparent sm:text-6xl md:text-7xl">
              ALURICHAT
            </p>
            <h1 className="mt-6 max-w-2xl text-balance font-display text-3xl font-medium leading-snug text-ink sm:text-4xl md:text-[2.75rem] md:leading-tight">
              Atendimento inteligente. Vendas automatizadas. Operação sob controlo.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
              WhatsApp, equipa e automações numa operação que vive da conversa.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="group relative inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-2xl bg-brand-gradient px-8 text-base font-semibold text-white animate-btn-glow transition duration-300 hover:scale-[1.03] hover:brightness-110 active:scale-[0.98]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-btn-sheen"
                />
                <UserPlus className="relative h-5 w-5 transition duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <span className="relative">Criar conta</span>
              </Link>
              <Link
                href="/login"
                className="group relative inline-flex h-14 items-center gap-2.5 rounded-2xl bg-white/[0.06] px-7 text-base font-semibold text-ink backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_32px_-8px_rgba(34,211,238,0.45)] active:translate-y-0"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(10,47,107,0.35), rgba(34,211,238,0.12))',
                  }}
                />
                <LogIn className="relative h-5 w-5 text-brand-cyan transition duration-300 group-hover:translate-x-0.5 group-hover:text-brand-light" />
                <span className="relative">Entrar</span>
                <span
                  aria-hidden
                  className="relative ml-0.5 inline-block translate-x-0 opacity-60 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="relative scroll-mt-24 border-t border-white/5 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand-cyan">Recursos</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Tudo o que a conversa precisa para vender
            </h2>
            <p className="mt-3 text-ink-muted">
              Do primeiro “olá” no WhatsApp ao follow-up automático — sem trocar de ferramenta.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {resources.map((r) => (
              <div key={r.title} className="group flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient/90 text-white shadow-glow transition group-hover:scale-105">
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{r.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="relative scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-brand-cyan">Benefícios</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Mais conversas. Menos caos.
            </h2>
            <p className="mt-3 text-ink-muted">
              Uma operação social e animada — mas com disciplina de produto e identidade Alurichat.
            </p>
          </div>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="text-center sm:text-left">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-brand-cyan sm:mx-0">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-semibold text-ink">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona — FAQ */}
      <section id="como-funciona" className="relative scroll-mt-24 border-t border-white/5 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-medium text-brand-cyan">Como funciona</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Perguntas frequentes
            </h2>
            <p className="mt-3 text-ink-muted">
              Respostas diretas para perceber o fluxo — da ligação do WhatsApp aos planos.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow"
            >
              <UserPlus className="h-4 w-4" />
              Criar conta agora
            </Link>
          </div>
          <div className="divide-y divide-white/5 border-y border-white/5">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:text-brand-cyan"
                    aria-expanded={open}
                  >
                    <span className="font-display text-sm font-semibold text-ink sm:text-base">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-brand-cyan transition',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-all duration-300',
                      open ? 'grid-rows-[1fr] pb-4 opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <p className="overflow-hidden text-sm leading-relaxed text-ink-muted">
                      {f.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="relative scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-brand-cyan">Planos</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Escolha o ritmo da sua operação
            </h2>
            <p className="mt-3 text-ink-muted">
              Preços de referência — ajuste quando a sua conversa crescer.
            </p>
          </div>
          <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3 lg:gap-5">
            {plans.map((p) => (
              <div
                key={p.name}
                className={cn(
                  'relative flex flex-col rounded-2xl p-6 transition duration-300',
                  p.highlight
                    ? 'z-10 border-2 border-brand-cyan bg-gradient-to-b from-[#0a2f6b]/50 via-[#071a2e] to-[#061018] p-7 shadow-[0_0_60px_-8px_rgba(34,211,238,0.65),0_0_0_1px_rgba(34,211,238,0.35)] lg:-translate-y-2 lg:scale-[1.02]'
                    : 'border border-white/10 bg-white/[0.03]',
                )}
              >
                <h3
                  className={cn(
                    'font-display text-xl font-semibold text-ink',
                    p.highlight && 'text-2xl',
                  )}
                >
                  {p.name}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">{p.hint}</p>
                <p
                  className={cn(
                    'mt-5 font-display font-semibold tracking-tight',
                    p.highlight ? 'text-5xl text-brand-cyan' : 'text-4xl text-ink',
                  )}
                >
                  {p.price}
                  {p.period ? (
                    <span
                      className={cn(
                        'ml-1 text-sm font-normal',
                        p.highlight ? 'text-brand-cyan/80' : 'text-ink-faint',
                      )}
                    >
                      {p.period}
                    </span>
                  ) : null}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          p.highlight ? 'text-brand-cyan' : 'text-brand-light',
                        )}
                      />
                      <span className={p.highlight ? 'text-ink' : 'text-ink-muted'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${encodeURIComponent(p.name.toLowerCase())}`}
                  className={cn(
                    'mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
                    p.highlight
                      ? 'h-12 bg-brand-gradient text-base text-white shadow-glow animate-btn-glow hover:brightness-110'
                      : 'bg-white/5 text-ink hover:bg-white/10',
                  )}
                >
                  <UserPlus className="h-4 w-4" />
                  Criar conta
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-faint">
            *Limites e preços podem variar conforme o volume e o onboarding.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-6">
          <BrandLogo variant="wordmark" className="h-10 w-auto max-w-[220px]" />
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-ink-muted">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-brand-cyan">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-muted hover:bg-white/5 hover:text-ink"
            >
              <LogIn className="h-3.5 w-3.5 text-brand-cyan" />
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 text-sm font-semibold text-white"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Criar conta
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} Atendimento WhatsApp inteligente para empresas · Makiratec
        </p>
      </footer>
    </main>
  );
}
