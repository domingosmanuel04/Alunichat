'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

type LeadRow = Record<string, unknown> & {
  id?: string;
  status?: string;
  source?: string;
  stage?: string;
  score?: number;
  contact?: { name?: string; email?: string };
};

export default function CrmPage() {
  const load = useCallback(() => api.listCrmLeads() as Promise<LeadRow[]>, []);

  return (
    <>
      <AppTopbar title="CRM" subtitle="Leads e oportunidades" />
      <ApiListPage<LeadRow>
        title="Leads"
        emptyMessage="Nenhum lead retornado pela API."
        load={load}
        columns={[
          {
            key: 'name',
            label: 'Contato',
            render: (item) => String(item.contact?.name ?? item.name ?? '—'),
          },
          {
            key: 'email',
            label: 'E-mail',
            render: (item) => String(item.contact?.email ?? item.email ?? '—'),
          },
          { key: 'status', label: 'Status' },
          { key: 'source', label: 'Origem' },
          {
            key: 'score',
            label: 'Score',
            render: (item) => (item.score != null ? String(item.score) : '—'),
          },
        ]}
      />
    </>
  );
}
