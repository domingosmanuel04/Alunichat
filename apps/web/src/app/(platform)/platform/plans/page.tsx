'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="Plans"
      subtitle="Planos SaaS"
      endpoint="/platform/plans"
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'tier', label: 'Tier' },
        { key: 'price', label: 'Preço' },
      ]}
    />
  );
}
