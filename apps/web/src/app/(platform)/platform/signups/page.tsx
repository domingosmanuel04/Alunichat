'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/ApiListPage';
import { api, ApiError } from '@/lib/api';
import { Check, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type PendingSignup = {
  id: string;
  name?: string;
  slug?: string;
  createdAt?: string;
  owner?: { name?: string; email?: string };
  signup?: {
    phone?: string | null;
    submittedAt?: string;
    paymentProofUrl?: string | null;
    paymentProofName?: string | null;
  };
};

export default function PlatformSignupsPage() {
  const [items, setItems] = useState<PendingSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [ownerPassword, setOwnerPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const signups = (await api.platformPendingSignups()) as PendingSignup[];
      setItems(signups);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar pedidos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    const password = ownerPassword.trim();
    if (password.length < 8) {
      toast.error('Defina uma senha com pelo menos 8 caracteres');
      return;
    }
    setActing(id);
    try {
      await api.approveSignup(id, password);
      toast.success('Conta aprovada — senha definida e enviada ao utilizador');
      setApproveId(null);
      setOwnerPassword('');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao aprovar');
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Motivo da rejeição (opcional):') || undefined;
    setActing(id);
    try {
      await api.rejectSignup(id, reason);
      toast.success('Pedido rejeitado');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao rejeitar');
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <AppTopbar
        title="Aprovações"
        subtitle="Pedidos de registo com comprovativo de pagamento"
      />
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sem pedidos pendentes"
            description="Quando alguém criar conta e enviar comprovativo, aparece aqui."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const hasProof = Boolean(item.signup?.paymentProofUrl);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-surface-border bg-surface-raised/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-ink">{item.name}</h3>
                        <Badge>{item.slug}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {item.owner?.name || '—'} · {item.owner?.email || '—'}
                        {item.signup?.phone ? ` · ${item.signup.phone}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        Enviado em{' '}
                        {item.signup?.submittedAt || item.createdAt
                          ? new Date(
                              String(item.signup?.submittedAt || item.createdAt),
                            ).toLocaleString('pt-PT')
                          : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hasProof ? (
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-border px-3 text-sm text-ink-muted hover:bg-white/5 hover:text-ink"
                          onClick={() => {
                            void api
                              .openPaymentProof(item.signup?.paymentProofUrl, {
                                platform: true,
                              })
                              .catch((err) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : 'Falha ao abrir comprovativo',
                                ),
                              );
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver comprovativo
                        </button>
                      ) : null}
                      <Button
                        size="sm"
                        loading={acting === item.id}
                        onClick={() => {
                          setApproveId(item.id);
                          setOwnerPassword('');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={acting === item.id}
                        onClick={() => void reject(item.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Recusar
                      </Button>
                    </div>
                  </div>
                  {approveId === item.id ? (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="text-sm font-medium text-ink">
                        Definir senha de acesso para {item.owner?.email || 'o utilizador'}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Esta senha será enviada por e-mail após a aprovação.
                      </p>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <label className="min-w-[220px] flex-1 text-xs text-ink-muted">
                          Senha
                          <input
                            type="text"
                            value={ownerPassword}
                            onChange={(e) => setOwnerPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            className="mt-1 h-10 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 text-sm text-ink outline-none focus:border-brand"
                          />
                        </label>
                        <Button
                          size="sm"
                          loading={acting === item.id}
                          onClick={() => void approve(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-500"
                        >
                          Confirmar aprovação
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={acting === item.id}
                          onClick={() => {
                            setApproveId(null);
                            setOwnerPassword('');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
