'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PortalTicket = {
  id?: string;
  number?: string | number;
  subject?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  contactName?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
};

export default function PortalTicketPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [data, setData] = useState<PortalTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ticket = await api.portalGet(token);
        if (!cancelled) {
          setData(ticket);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Link inválido ou expirado');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface bg-hero-glow px-4 py-16">
      <div className="absolute left-6 top-6">
        <Link href="/" className="inline-flex items-center">
          <BrandLogo variant="wordmark" className="h-10 w-auto max-w-[220px]" priority />
        </Link>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised/80 p-8 backdrop-blur-md">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink">Portal indisponível</h1>
            <p className="mt-2 text-sm text-red-300">{error}</p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              {data?.companyName || 'ALURICHAT'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
              Ticket #{data?.number ?? '—'}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">{data?.subject || 'Sem assunto'}</p>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Estado</dt>
                <dd>
                  <Badge tone="brand">{data?.status || '—'}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Prioridade</dt>
                <dd className="text-ink">{data?.priority || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Contacto</dt>
                <dd className="text-ink">{data?.contactName || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Atualizado</dt>
                <dd className="text-ink-muted">
                  {data?.updatedAt
                    ? new Date(data.updatedAt).toLocaleString('pt-PT')
                    : '—'}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </main>
  );
}
