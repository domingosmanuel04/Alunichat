import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/20 font-semibold text-brand-light ring-1 ring-brand/30',
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}
