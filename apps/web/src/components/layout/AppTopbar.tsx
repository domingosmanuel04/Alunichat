'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth-store';
import { LogOut, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ReactNode } from 'react';

type AppTopbarProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function AppTopbar({ title, subtitle, actions }: AppTopbarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-surface-border bg-surface/60 px-5 backdrop-blur-md">
      <div className="min-w-0">
        {title ? (
          <h1 className="truncate font-display text-base font-semibold text-ink">{title}</h1>
        ) : null}
        {subtitle ? <p className="truncate text-xs text-ink-faint">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        <div
          role="button"
          tabIndex={0}
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
            )
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
              );
            }
          }}
          className="hidden w-80 cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-sm text-ink-faint md:flex lg:w-96"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Buscar…</span>
          <kbd className="rounded border border-white/10 px-1.5 text-[10px]">⌘K</kbd>
        </div>

        <div className="flex items-center gap-2">
          <Avatar name={user?.name || user?.email} size="sm" />
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium text-ink">{user?.name || user?.email || '—'}</p>
            <p className="text-[10px] text-ink-faint">{user?.role || user?.platformRole || ''}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            router.replace('/login');
          }}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
