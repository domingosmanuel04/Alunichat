'use client';

import { PlatformListPage } from '@/components/layout/PlatformListPage';

export default function Page() {
  return (
    <PlatformListPage
      title="System Logs"
      subtitle="Logs da plataforma"
      endpoint="/platform/system-logs"
      columns={[
        { key: 'level', label: 'Level' },
        { key: 'message', label: 'Message' },
        { key: 'createdAt', label: 'Quando' },
      ]}
    />
  );
}
