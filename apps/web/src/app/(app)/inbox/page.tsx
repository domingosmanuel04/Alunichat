'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { InboxLayout } from '@/components/inbox/InboxLayout';

export default function InboxPage() {
  return (
    <>
      <AppTopbar title="Caixa de entrada" subtitle="Filas · Conversas · Contato" />
      <InboxLayout />
    </>
  );
}
