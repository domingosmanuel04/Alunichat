'use client';

import { motion } from 'framer-motion';

type FloorLampProps = {
  isOn: boolean;
  onToggle: () => void;
};

export function FloorLamp({ isOn, onToggle }: FloorLampProps) {
  return (
    <div className="relative flex h-full min-h-[420px] w-full max-w-md items-end justify-center pb-8 sm:pb-12">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: isOn ? 1 : 0 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="absolute left-1/2 top-[18%] h-[70%] w-[90%] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,216,154,0.28) 0%, rgba(245,194,107,0.12) 35%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-40 w-[120%] -translate-x-1/2 blur-2xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(245,194,107,0.16) 0%, transparent 70%)',
          }}
        />
      </motion.div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isOn}
        aria-label={isOn ? 'Desligar a lâmpada' : 'Acender a lâmpada'}
        className="group relative z-10 flex h-[min(68vh,560px)] w-[180px] cursor-pointer flex-col items-center border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-lamp-amber/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-[6%] h-44 w-56 -translate-x-1/2 rounded-full blur-2xl"
          animate={{
            opacity: isOn ? 0.85 : 0,
            scale: isOn ? 1 : 0.75,
          }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background:
              'radial-gradient(circle, rgba(255,232,194,0.7) 0%, rgba(245,194,107,0.35) 40%, transparent 70%)',
          }}
        />

        <div className="relative z-10 mt-2 flex w-[128px] flex-col items-center">
          <div className="h-1.5 w-[72%] rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a]" />
          <motion.div
            className="relative h-[92px] w-full origin-top"
            style={{
              clipPath: 'polygon(18% 0%, 82% 0%, 100% 100%, 0% 100%)',
            }}
            animate={{
              background: isOn
                ? 'linear-gradient(180deg, #f7e0b0 0%, #e8b86a 55%, #c99445 100%)'
                : 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 60%, #121212 100%)',
              boxShadow: isOn
                ? '0 18px 40px rgba(245,194,107,0.35), inset 0 -8px 20px rgba(255,255,255,0.18)'
                : '0 8px 20px rgba(0,0,0,0.45), inset 0 -6px 12px rgba(0,0,0,0.5)',
            }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="absolute inset-x-[22%] top-[18%] h-[55%] rounded-full blur-md"
              animate={{
                opacity: isOn ? 0.9 : 0,
                background: isOn
                  ? 'radial-gradient(circle, #fff6e4 0%, rgba(255,216,154,0.5) 50%, transparent 80%)'
                  : 'transparent',
              }}
              transition={{ duration: 0.8 }}
            />
          </motion.div>
        </div>

        <div className="relative z-10 mt-[-2px] flex flex-1 flex-col items-center">
          <div className="h-3 w-3 rounded-full bg-[#4a4a4a] shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)]" />
          <div className="h-full w-[5px] rounded-full bg-gradient-to-b from-[#4a4a4a] via-[#2f2f2f] to-[#1f1f1f]" />
        </div>

        <div className="relative z-10 mt-auto flex flex-col items-center">
          <div className="h-2 w-10 rounded-full bg-[#2e2e2e]" />
          <div className="mt-[-2px] h-3 w-24 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] shadow-[0_8px_16px_rgba(0,0,0,0.55)]" />
          <div className="mt-[-4px] h-2 w-28 rounded-full bg-[#121212]" />
        </div>

        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-8 w-40 -translate-x-1/2 rounded-[100%] blur-md"
          animate={{
            opacity: isOn ? 0.55 : 0,
            scaleX: isOn ? 1.15 : 0.7,
          }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,216,154,0.55) 0%, transparent 70%)',
          }}
        />

        <span className="sr-only">Alternar lâmpada</span>
      </button>

      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.18em] text-white/25">
        {isOn ? 'lâmpada acesa' : 'toque para acender'}
      </p>
    </div>
  );
}
