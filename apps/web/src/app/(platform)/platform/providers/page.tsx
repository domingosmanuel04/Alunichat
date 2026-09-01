'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="Providers"
      subtitle="Provedores de canal / IA"
      endpoint="/platform/providers"
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'type', label: 'Tipo' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
