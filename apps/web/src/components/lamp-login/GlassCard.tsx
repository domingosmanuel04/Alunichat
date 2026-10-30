'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

type GlassCardProps = {
  children: ReactNode;
  visible?: boolean;
  className?: string;
};

export function GlassCard({ children, visible = true, className = '' }: GlassCardProps) {
  return (
    <AnimatePresence mode="wait">
      {visible ? (
        <motion.div
          key="glass-card"
          initial={{ opacity: 0, y: 28, filter: 'blur(10px)', scale: 0.97 }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0, y: 16, filter: 'blur(8px)', scale: 0.98 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10 ${className}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.04) 100%)',
            }}
          />
          <div className="relative z-10">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
