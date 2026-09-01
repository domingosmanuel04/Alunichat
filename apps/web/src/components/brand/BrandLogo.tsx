import Image from 'next/image';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  /** full = icon + wordmark + tagline; wordmark = icon + ALURICHAT; mark = icon only */
  variant?: 'full' | 'wordmark' | 'mark';
  className?: string;
  priority?: boolean;
};

const sizes = {
  full: { width: 480, height: 140, src: '/logo.png?v=4', alt: 'ALURICHAT' },
  wordmark: { width: 360, height: 100, src: '/logo-wordmark.png?v=4', alt: 'ALURICHAT' },
  mark: { width: 64, height: 64, src: '/icone.png?v=4', alt: 'ALURICHAT' },
} as const;

export function BrandLogo({
  variant = 'wordmark',
  className,
  priority = false,
}: BrandLogoProps) {
  const s = sizes[variant];
  return (
    <Image
      src={s.src}
      alt={s.alt}
      width={s.width}
      height={s.height}
      priority={priority}
      unoptimized
      className={cn('h-auto max-h-full w-auto max-w-full object-contain object-left', className)}
    />
  );
}
