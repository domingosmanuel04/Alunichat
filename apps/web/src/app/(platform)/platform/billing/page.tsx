'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="Billing"
      subtitle="Faturamento"
      endpoint="/platform/billing"
      columns={[
        { key: 'tenant', label: 'Tenant' },
        { key: 'amount', label: 'Valor' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
