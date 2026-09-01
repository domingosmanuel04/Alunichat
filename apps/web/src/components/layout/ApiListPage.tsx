'use client';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

type ApiListPageProps<T> = {
  title: string;
  subtitle?: string;
  emptyMessage: string;
  load: () => Promise<T[]>;
  renderItem?: (item: T, index: number) => React.ReactNode;
  columns?: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  getKey?: (item: T, index: number) => string;
};

export function ApiListPage<T extends Record<string, unknown>>({
  title,
  subtitle,
  emptyMessage,
  load,
  renderItem,
  columns,
  getKey,
}: ApiListPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const data = await load();
      setItems(data);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 404) {
        setMissing(true);
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao carregar');
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
        <div>
          <h1 className="font-display text-lg font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          Atualizar
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : missing ? (
          <EmptyState
            title="Endpoint indisponível"
            description="A API ainda não expõe este recurso. A página está pronta para quando o endpoint existir."
          />
        ) : error ? (
          <EmptyState title="Erro ao carregar" description={error} />
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum item" description={emptyMessage} />
        ) : columns ? (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={getKey?.(item, index) ?? String(item.id ?? index)} className="border-t border-surface-border">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-ink">
                        {c.render
                          ? c.render(item)
                          : String(item[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={getKey?.(item, index) ?? String(item.id ?? index)}
                className="rounded-xl border border-surface-border bg-surface-raised/60 px-4 py-3"
              >
                {renderItem ? renderItem(item, index) : (
                  <p className="text-sm text-ink">{String(item.name ?? item.title ?? item.id)}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-raised/40 px-6 py-16 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>
    </div>
  );
}
