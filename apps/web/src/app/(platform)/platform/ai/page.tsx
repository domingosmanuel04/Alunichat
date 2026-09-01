'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="AI"
      subtitle="Configuração global de IA"
      endpoint="/platform/ai"
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'provider', label: 'Provider' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
