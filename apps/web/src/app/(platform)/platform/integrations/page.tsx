'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="Integrations"
      subtitle="Integrações da plataforma"
      endpoint="/platform/integrations"
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'provider', label: 'Provider' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
