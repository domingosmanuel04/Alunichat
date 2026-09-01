'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type ChangelogEntry = {
  version?: string;
  date?: string;
  title?: string;
  items?: string[];
};

export default function ChangelogPage() {
  const [items, setItems] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getChangelog();
        if (!cancelled) {
          setItems(res.items || []);
          setGeneratedAt(res.generatedAt || null);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Falha ao carregar novidades');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AppTopbar
        title="Novidades"
        subtitle="Changelog do produto ALURICHAT"
      />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <div className="mx-auto max-w-2xl space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-surface-border py-16 text-center text-sm text-ink-muted">
            Sem entradas no changelog.
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {generatedAt ? (
              <p className="text-xs text-ink-faint">
                Atualizado:{' '}
                {new Date(generatedAt).toLocaleString('pt-BR')}
              </p>
            ) : null}
            {items.map((entry) => (
              <article
                key={`${entry.version}-${entry.date}-${entry.title}`}
                className="rounded-xl border border-surface-border bg-surface-raised/40 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {entry.title || entry.version || 'Atualização'}
                  </h2>
                  <p className="text-xs text-ink-faint">
                    {entry.version ? `v${entry.version}` : ''}
                    {entry.date ? ` · ${entry.date}` : ''}
                  </p>
                </div>
                {entry.items && entry.items.length > 0 ? (
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink-muted">
                    {entry.items.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
