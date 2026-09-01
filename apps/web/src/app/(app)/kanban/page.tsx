'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { DealKanban } from '@/components/crm/DealKanban';

export default function KanbanPage() {
  return (
    <>
      <AppTopbar title="Kanban" subtitle="Pipelines e negócios" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <DealKanban />
      </div>
    </>
  );
}
