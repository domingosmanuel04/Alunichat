import { cn } from '@/lib/utils';
import { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, children, ...props }, ref) => (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium text-ink-muted">{label}</span> : null}
      <select
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-ink outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  ),
);
Select.displayName = 'Select';
