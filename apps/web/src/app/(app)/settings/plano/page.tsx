'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import {
  CalendarDays,
  CheckCircle2,
  Smartphone,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type PlanRecord = {
  id?: string;
  name?: string;
  displayName?: string;
  priceMonthly?: number | string;
  limits?: Record<string, number>;
  features?: Record<string, boolean>;
};

type SubscriptionPayload = {
  subscription?: {
    status?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    plan?: PlanRecord;
  };
  usage?: {
    live?: {
      channels?: number;
      users?: number;
      channelsLimit?: number | null;
      usersLimit?: number | null;
    };
  };
  planChange?: {
    status?: string;
    requestedPlanName?: string;
    currentPlanName?: string;
    paymentProofUrl?: string | null;
    submittedAt?: string;
  } | null;
  paymentProofs?: {
    kind?: string;
    planName?: string;
    previousPlanName?: string;
    paymentProofUrl?: string;
    paymentProofName?: string;
    submittedAt?: string;
    status?: string;
  }[];
};

const PLAN_COPY: Record<
  string,
  { label: string; description: string }
> = {
  FREE: {
    label: 'Gratuito',
    description: 'Ideal para experimentar a plataforma',
  },
  STARTER: {
    label: 'Starter',
    description: 'Para equipas pequenas a começar',
  },
  PRO: {
    label: 'Profissional',
    description: 'Mais produtividade para equipas em crescimento',
  },
  BUSINESS: {
    label: 'Empresarial',
    description: 'Recursos avançados para operações maiores',
  },
  ENTERPRISE: {
    label: 'Enterprise',
    description: 'Solução personalizada para grandes operações',
  },
};

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-PT');
}

function formatPrice(amount?: number | string) {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 'Grátis';
  return `${n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })}/mês`;
}

function statusLabel(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'TRIALING') return 'Ativo';
  if (s === 'PAST_DUE') return 'Em atraso';
  if (s === 'CANCELED' || s === 'CANCELLED') return 'Cancelado';
  return status || '—';
}

function limitLabel(n?: number | null) {
  if (n == null) return '—';
  if (n < 0) return 'Ilimitado';
  return String(n);
}

function progressPct(used: number, limit?: number | null) {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function buildIncludedResources(plan?: PlanRecord): string[] {
  if (!plan) return [];
  const limits = plan.limits || {};
  const features = plan.features || {};
  const items: string[] = [];

  if (limits.channels != null) {
    items.push(
      limits.channels < 0
        ? 'Instâncias WhatsApp ilimitadas'
        : `Até ${limits.channels} instâncias WhatsApp`,
    );
  }
  if (limits.users != null) {
    items.push(
      limits.users < 0
        ? 'Utilizadores ilimitados na equipa'
        : `Até ${limits.users} usuários na equipe`,
    );
  }
  if (features.inbox || features.automations) {
    items.push('Chat, Kanban e automações');
  }
  if (features.apiAccess) {
    items.push('Webhooks e API REST');
  }
  if (features.crm) items.push('CRM e pipeline de vendas');
  if (features.aiAgents) items.push('Agentes de IA');
  if (features.campaigns) items.push('Campanhas de marketing');
  if (features.customDomain) items.push('Domínio personalizado');
  if (features.sso) items.push('SSO corporativo');

  return items.slice(0, 6);
}

function UsageCard({
  icon,
  label,
  used,
  limit,
}: {
  icon: ReactNode;
  label: string;
  used: number;
  limit?: number | null;
}) {
  const pct = progressPct(used, limit);
  const unlimited = limit != null && limit < 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#1e2228] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            {icon}
          </span>
          <span className="text-sm font-medium text-zinc-200">{label}</span>
        </div>
        <span className="text-sm font-semibold text-white">
          {used} / {unlimited ? '∞' : limitLabel(limit)}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: unlimited ? '8%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SettingsPlanoPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [trial, setTrial] = useState<{
    daysLeft?: number | null;
    expired?: boolean;
    softBlocked?: boolean;
    trialEndsAt?: string | null;
  } | null>(null);
  const [addons, setAddons] = useState<{
    available?: { key: string; label: string; priceMonthly: number }[];
    active?: string[];
  } | null>(null);
  const [addonsBusy, setAddonsBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sub, planList, invoiceList, trialRes, addonsRes] = await Promise.all([
        api.getBillingSubscription(),
        api.listBillingPlans().catch(() => []),
        api.listInvoices().catch(() => []),
        api.getTrial().catch(() => null),
        api.getAddons().catch(() => null),
      ]);
      setData(sub as SubscriptionPayload);
      setPlans(planList as PlanRecord[]);
      setInvoices(invoiceList);
      setTrial(trialRes);
      setAddons(addonsRes);
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar plano');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subscription = data?.subscription;
  const plan = subscription?.plan;
  const planKey = String(plan?.name || '').toUpperCase();
  const copy = PLAN_COPY[planKey] || {
    label: plan?.displayName || plan?.name || 'Plano',
    description: 'O seu plano atual na plataforma',
  };

  const live = data?.usage?.live;
  const channelsUsed = live?.channels ?? 0;
  const usersUsed = live?.users ?? 0;
  const channelsLimit = live?.channelsLimit ?? plan?.limits?.channels ?? null;
  const usersLimit = live?.usersLimit ?? plan?.limits?.users ?? null;

  const included = useMemo(() => buildIncludedResources(plan), [plan]);
  const active =
    (subscription?.status || '').toUpperCase() === 'ACTIVE' ||
    (subscription?.status || '').toUpperCase() === 'TRIALING';

  const otherPlans = plans.filter(
    (p) => String(p.name || '').toUpperCase() !== planKey,
  );
  const planChange = data?.planChange;
  const paymentProofs = data?.paymentProofs || [];
  const awaitingChange = (planChange?.status || '') === 'awaiting_approval';

  async function submitPlanChange() {
    if (!selectedPlan || !proofFile) {
      toast.error('Selecione o plano e anexe o comprovativo');
      return;
    }
    setSubmitting(true);
    try {
      await api.requestPlanChange(selectedPlan, proofFile);
      toast.success('Pedido de mudança enviado');
      setShowForm(false);
      setSelectedPlan('');
      setProofFile(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao pedir mudança');
    } finally {
      setSubmitting(false);
    }
  }

  async function openInvoiceHtml() {
    setInvoiceLoading(true);
    try {
      const res = await api.getInvoiceHtml();
      const html =
        typeof res === 'string'
          ? res
          : typeof res?.html === 'string'
            ? res.html
            : null;
      if (!html) {
        toast.error('Fatura sem conteúdo HTML');
        return;
      }
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fatura-alurichat.html';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao obter fatura');
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function toggleAddon(key: string) {
    const active = new Set(addons?.active || []);
    if (active.has(key)) active.delete(key);
    else active.add(key);
    setAddonsBusy(true);
    try {
      const next = await api.setAddons(Array.from(active));
      setAddons(next);
      toast.success('Extras atualizados');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar extras');
    } finally {
      setAddonsBusy(false);
    }
  }

  return (
    <>
      <AppTopbar title="Plano" subtitle="Subscrição e utilização da sua empresa" />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-44 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !subscription?.plan ? (
          <div className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-[#1e2228] p-6 text-sm text-zinc-400">
            Sem subscrição ativa para este cliente.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {trial && (trial.daysLeft != null || trial.expired) ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  trial.expired || trial.softBlocked
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                }`}
              >
                {trial.expired || trial.softBlocked
                  ? 'O período de trial terminou. Faça upgrade para continuar sem limitações.'
                  : `Trial ativo: ${trial.daysLeft} dia(s) restante(s)${
                      trial.trialEndsAt
                        ? ` · até ${formatDate(String(trial.trialEndsAt))}`
                        : ''
                    }`}
              </div>
            ) : null}

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-indigo-900 p-5 shadow-lg md:p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-emerald-50/90">Plano atual</p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    active
                      ? 'bg-emerald-950/40 text-white ring-1 ring-white/20'
                      : 'bg-black/30 text-zinc-200'
                  }`}
                >
                  {statusLabel(subscription.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                    {copy.label}
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-emerald-50/90">
                    {copy.description}
                  </p>
                </div>
                <p className="text-2xl font-bold text-white md:text-3xl">
                  {formatPrice(plan?.priceMonthly)}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-emerald-50/95">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Início: {formatDate(subscription.currentPeriodStart)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Validade: {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <UsageCard
                icon={<Smartphone className="h-4 w-4" />}
                label="Instâncias WhatsApp"
                used={channelsUsed}
                limit={channelsLimit}
              />
              <UsageCard
                icon={<Users className="h-4 w-4" />}
                label="Usuários"
                used={usersUsed}
                limit={usersLimit}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-[#1e2228] p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">
                  Recursos incluídos
                </h3>
              </div>
              {included.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">
                  Sem detalhes de recursos para este plano.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {included.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-zinc-200"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#1e2228] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Mudar de plano
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Escolha outro plano e envie o comprovativo de pagamento.
                  </p>
                </div>
                {!awaitingChange ? (
                  <button
                    type="button"
                    onClick={() => setShowForm((v) => !v)}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Pedir mudança
                  </button>
                ) : null}
              </div>

              {awaitingChange ? (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                  Pedido pendente: {planChange?.currentPlanName || '—'} →{' '}
                  {planChange?.requestedPlanName || '—'}
                  {planChange?.submittedAt
                    ? ` · ${new Date(planChange.submittedAt).toLocaleString('pt-PT')}`
                    : ''}
                </div>
              ) : null}

              {showForm && !awaitingChange ? (
                <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                  <label className="block text-sm text-zinc-300">
                    Novo plano
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#15181c] px-3 text-sm text-white"
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                    >
                      <option value="">Selecionar…</option>
                      {otherPlans.map((p) => (
                        <option key={String(p.name)} value={String(p.name)}>
                          {(PLAN_COPY[String(p.name || '').toUpperCase()]?.label ||
                            p.displayName ||
                            p.name) +
                            ` · ${formatPrice(p.priceMonthly)}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-zinc-300">
                    Comprovativo
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="mt-1 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:text-white"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitPlanChange()}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {submitting ? 'A enviar…' : 'Enviar pedido'}
                  </button>
                </div>
              ) : null}

              {otherPlans.length > 0 ? (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {otherPlans.map((p) => {
                    const key = String(p.name || '').toUpperCase();
                    const meta = PLAN_COPY[key];
                    return (
                      <li
                        key={String(p.name)}
                        className="flex flex-col gap-2 rounded-lg border border-white/10 px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {meta?.label || p.displayName || p.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {formatPrice(p.priceMonthly)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!p.name || awaitingChange}
                          onClick={() => {
                            setSelectedPlan(String(p.name));
                            setShowForm(true);
                          }}
                          className="rounded-md bg-emerald-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          Pedir com comprovativo
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Sem outros planos disponíveis.</p>
              )}
            </div>

            {addons?.available && addons.available.length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#1e2228] p-5">
                <h3 className="text-base font-semibold text-white">Extras (add-ons)</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Ative capacidades adicionais na sua subscrição.
                </p>
                <ul className="mt-4 space-y-2">
                  {addons.available.map((a) => {
                    const on = (addons.active || []).includes(a.key);
                    return (
                      <li
                        key={a.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm text-zinc-200">{a.label}</p>
                          <p className="text-xs text-zinc-500">
                            {formatPrice(a.priceMonthly)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={addonsBusy}
                          onClick={() => void toggleAddon(a.key)}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-60 ${
                            on
                              ? 'bg-emerald-600 text-white'
                              : 'border border-white/15 text-zinc-300 hover:bg-white/5'
                          }`}
                        >
                          {on ? 'Ativo' : 'Ativar'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-[#1e2228] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">Faturas</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Fatura do período atual e histórico.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={invoiceLoading}
                  onClick={() => void openInvoiceHtml()}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {invoiceLoading ? 'A abrir…' : 'Fatura PDF/HTML'}
                </button>
              </div>
              {invoices.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Sem histórico de faturas.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {invoices.slice(0, 12).map((inv, idx) => (
                    <li
                      key={String(inv.id || inv.periodStart || idx)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="text-zinc-200">
                          {String(inv.planName || inv.kind || 'Fatura')}
                          {inv.status ? ` · ${String(inv.status)}` : ''}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {inv.periodStart
                            ? formatDate(String(inv.periodStart))
                            : inv.submittedAt
                              ? formatDate(String(inv.submittedAt))
                              : '—'}
                          {inv.periodEnd ? ` → ${formatDate(String(inv.periodEnd))}` : ''}
                          {inv.priceMonthly != null
                            ? ` · ${formatPrice(inv.priceMonthly as number | string)}`
                            : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#1e2228] p-5">
              <h3 className="text-base font-semibold text-white">
                Últimos comprovativos
              </h3>
              {paymentProofs.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  Ainda não há comprovativos enviados.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {paymentProofs.slice(0, 10).map((proof, idx) => {
                    const hasProof = Boolean(proof.paymentProofUrl);
                    return (
                      <li
                        key={`${proof.submittedAt || idx}-${proof.planName || idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="text-zinc-200">
                            {proof.previousPlanName || '—'} → {proof.planName || '—'}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {proof.submittedAt
                              ? new Date(proof.submittedAt).toLocaleString('pt-PT')
                              : '—'}
                            {proof.status ? ` · ${proof.status}` : ''}
                          </p>
                        </div>
                        {hasProof ? (
                          <button
                            type="button"
                            className="text-xs text-emerald-400 hover:underline"
                            onClick={() => {
                              void api
                                .openPaymentProof(proof.paymentProofUrl)
                                .catch((err) =>
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : 'Falha ao abrir comprovativo',
                                  ),
                                );
                            }}
                          >
                            Ver ficheiro
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
