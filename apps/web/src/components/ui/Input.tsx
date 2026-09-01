import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium text-ink-muted">{label}</span> : null}
      <input
        ref={ref}
        id={id}
        className={cn(
          'h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-ink placeholder:text-ink-faint outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20',
          error && 'border-red-500/60',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </label>
  ),
);
Input.displayName = 'Input';
