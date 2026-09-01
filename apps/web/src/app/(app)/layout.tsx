'use client';

import { AppSidebar } from '@/components/layout/AppSidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { useAuthStore } from '@/stores/auth-store';
import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useRealtimeInbox();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace('/login');
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-ink-muted">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface bg-app-glow">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <AppSidebar
          mode="tenant"
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 items-center gap-2 border-b border-surface-border px-3 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-muted hover:bg-white/5 hover:text-ink"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-medium text-ink">ALURICHAT</span>
        </div>
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}
