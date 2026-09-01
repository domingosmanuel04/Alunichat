'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

export default function CalendarPage() {
  const load = useCallback(() => api.listAppointments(), []);
  return (
    <>
      <AppTopbar title="Calendar" subtitle="Agendamentos" />
      <ApiListPage
        title="Agendamentos"
        emptyMessage="Nenhum agendamento na API."
        load={load}
        columns={[
          { key: 'title', label: 'Título' },
          { key: 'startsAt', label: 'Início' },
          { key: 'status', label: 'Status' },
        ]}
      />
    </>
  );
}
