'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { FloorLamp } from './FloorLamp';
import { GlassCard } from './GlassCard';
import { LoginForm, type LoginFormValues } from './LoginForm';

type LampLoginV3Props = {
  loading?: boolean;
  error?: string | null;
  mfaRequired?: boolean;
  showCaptcha?: boolean;
  captchaChallenge?: string;
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
};

export function LampLoginV3({
  loading,
  error,
  mfaRequired,
  showCaptcha,
  captchaChallenge,
  onSubmit,
}: LampLoginV3Props) {
  const [isLampOn, setIsLampOn] = useState(false);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-void font-lamp-sans text-white">
      <motion.div
        className="absolute left-6 top-6 z-20"
        animate={{ opacity: isLampOn ? 0 : 1, y: isLampOn ? -6 : 0 }}
        transition={{ duration: 0.45 }}
        style={{ pointerEvents: isLampOn ? 'none' : 'auto' }}
      >
        <Link href="/" className="inline-flex items-center opacity-90 transition hover:opacity-100">
          <BrandLogo variant="wordmark" className="h-11 w-auto max-w-[240px]" priority />
        </Link>
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{
          background: isLampOn
            ? 'radial-gradient(ellipse 80% 70% at 22% 45%, rgba(245,194,107,0.14) 0%, transparent 55%), linear-gradient(180deg, #141414 0%, #0f0f0f 45%, #0c0c0c 100%)'
            : 'linear-gradient(180deg, #080808 0%, #050505 50%, #030303 100%)',
        }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: isLampOn ? 0 : 0.72 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.45\'/%3E%3C/svg%3E")',
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{
          background: isLampOn
            ? 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)'
            : 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.85) 100%)',
        }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-4 lg:px-10">
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center lg:justify-start"
        >
          <FloorLamp isOn={isLampOn} onToggle={() => setIsLampOn((v) => !v)} />
        </motion.section>

        <section className="flex min-h-[320px] items-center justify-center lg:justify-end">
          <GlassCard visible={isLampOn}>
            <LoginForm
              loading={loading}
              error={error}
              mfaRequired={mfaRequired}
              showCaptcha={showCaptcha}
              captchaChallenge={captchaChallenge}
              onSubmit={onSubmit}
            />
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
