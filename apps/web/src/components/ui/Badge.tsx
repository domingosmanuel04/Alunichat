import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'brand';

const tones: Record<Tone, string> = {
  default: 'bg-white/5 text-ink-muted border-white/10',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  danger: 'bg-red-500/15 text-red-300 border-red-500/20',
  brand: 'bg-brand/15 text-brand-light border-brand/25',
};

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
