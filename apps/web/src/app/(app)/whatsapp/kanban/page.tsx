'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { DealKanban } from '@/components/crm/DealKanban';

export default function WhatsAppKanbanPage() {
  return (
    <>
      <AppTopbar title="WhatsApp · Kanban" subtitle="Funil comercial ligado às conversas" />
      <div className="flex-1 overflow-auto p-5">
        <DealKanban />
      </div>
    </>
  );
}
