'use client';

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** When false, hides the X / overlay close (Escape still calls onClose) */
  closable?: boolean;
};

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = 'md',
  closable = true,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closable]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {closable ? (
        <button
          type="button"
          aria-label="Close overlay"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl',
          sizes[size],
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? (
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          ) : (
            <span />
          )}
          {closable ? (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
