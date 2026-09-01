'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

export function PlatformListPage({
  title,
  subtitle,
  endpoint,
  emptyMessage,
  columns,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  emptyMessage?: string;
  columns?: { key: string; label: string }[];
}) {
  const load = useCallback(() => api.platformList(endpoint.replace(/^GET\s+/i, '')), [endpoint]);

  return (
    <>
      <AppTopbar title={title} subtitle={subtitle} />
      <ApiListPage
        title={title}
        emptyMessage={emptyMessage || 'Nenhum registro retornado pela API.'}
        load={load}
        columns={columns}
      />
    </>
  );
}
