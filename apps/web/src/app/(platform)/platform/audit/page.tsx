'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="Auditoria"
      subtitle="Trilha de auditoria"
      endpoint="/platform/audit"
      columns={[
        { key: 'actorLabel', label: 'Actor' },
        { key: 'action', label: 'Ação' },
        { key: 'tenantLabel', label: 'Empresa' },
        { key: 'createdAt', label: 'Quando' },
      ]}
    />
  );
}
