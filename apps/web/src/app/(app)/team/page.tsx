'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

export default function TeamPage() {
  const load = useCallback(() => api.listTeam(), []);
  return (
    <>
      <AppTopbar title="Team" subtitle="Usuários do tenant" />
      <ApiListPage
        title="Equipe"
        emptyMessage="Nenhum membro listado."
        load={load}
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'email', label: 'E-mail' },
          { key: 'role', label: 'Papel' },
        ]}
      />
    </>
  );
}
