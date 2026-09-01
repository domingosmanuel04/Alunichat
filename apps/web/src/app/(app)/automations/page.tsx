'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

export default function AutomationsPage() {
  const load = useCallback(() => api.listAutomations(), []);
  return (
    <>
      <AppTopbar title="Automations" subtitle="Workflows" />
      <ApiListPage
        title="Automações"
        emptyMessage="Nenhuma automação publicada."
        load={load}
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'status', label: 'Status' },
          { key: 'trigger', label: 'Trigger' },
        ]}
      />
    </>
  );
}
