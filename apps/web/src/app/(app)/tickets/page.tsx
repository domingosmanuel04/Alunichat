'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

export default function TicketsPage() {
  const load = useCallback(() => api.listTickets(), []);
  return (
    <>
      <AppTopbar title="Tickets" subtitle="Suporte estruturado" />
      <ApiListPage
        title="Tickets"
        emptyMessage="Nenhum ticket aberto ou listado."
        load={load}
        columns={[
          { key: 'subject', label: 'Assunto' },
          { key: 'status', label: 'Status' },
          { key: 'priority', label: 'Prioridade' },
        ]}
      />
    </>
  );
}
