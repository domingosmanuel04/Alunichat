'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="Usage"
      subtitle="Consumo"
      endpoint="/platform/usage"
      columns={[
        { key: 'tenant', label: 'Tenant' },
        { key: 'metric', label: 'Métrica' },
        { key: 'value', label: 'Valor' },
      ]}
    />
  );
}
