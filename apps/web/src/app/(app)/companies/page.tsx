'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { ApiListPage } from '@/components/layout/ApiListPage';
import { api } from '@/lib/api';
import { useCallback } from 'react';

export default function CompaniesPage() {
  const load = useCallback(() => api.listCompanies(), []);
  return (
    <>
      <AppTopbar title="Companies" subtitle="Empresas e contas" />
      <ApiListPage
        title="Empresas"
        emptyMessage="Nenhuma empresa na API."
        load={load}
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'website', label: 'Website' },
          { key: 'industry', label: 'Setor' },
          { key: 'taxId', label: 'CNPJ' },
        ]}
      />
    </>
  );
}
