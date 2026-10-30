import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0D9488',
          light: '#14B8A6',
          dark: '#0F766E',
          muted: '#134E4A',
          navy: '#0A2F6B',
          cyan: '#22D3EE',
        },
        surface: {
          DEFAULT: '#0B1220',
          raised: '#111827',
          overlay: '#1A2332',
          border: '#1E293B',
        },
        ink: {
          DEFAULT: '#F1F5F9',
          muted: '#94A3B8',
          faint: '#64748B',
        },
        void: {
          DEFAULT: '#0f0f0f',
          soft: '#161616',
          edge: '#1c1c1c',
        },
        lamp: {
          amber: '#f5c26b',
          glow: '#ffd89a',
          core: '#ffe8c2',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        'lamp-display': ['var(--font-fraunces)', 'Georgia', 'serif'],
        'lamp-sans': ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(20, 184, 166, 0.22), transparent), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(10, 47, 107, 0.35), transparent), radial-gradient(ellipse 40% 30% at 10% 80%, rgba(34, 211, 238, 0.08), transparent)',
        'app-glow':
          'radial-gradient(ellipse 60% 40% at 0% 0%, rgba(20, 184, 166, 0.08), transparent)',
        'brand-gradient':
          'linear-gradient(135deg, #0A2F6B 0%, #0D9488 48%, #22D3EE 100%)',
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(20, 184, 166, 0.35)',
        'glow-navy': '0 0 48px -10px rgba(10, 47, 107, 0.55)',
      },
      keyframes: {
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.55' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'msg-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '30%': { transform: 'translateY(-3px)', opacity: '1' },
        },
        'orbit-slow': {
          '0%': { transform: 'rotate(0deg) translateX(12px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(12px) rotate(-360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'btn-glow': {
          '0%, 100%': {
            boxShadow:
              '0 0 0 0 rgba(34, 211, 238, 0.35), 0 12px 40px -10px rgba(13, 148, 136, 0.55)',
          },
          '50%': {
            boxShadow:
              '0 0 0 10px rgba(34, 211, 238, 0), 0 16px 48px -8px rgba(34, 211, 238, 0.45)',
          },
        },
        'btn-sheen': {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '100%': { transform: 'translateX(220%) skewX(-12deg)' },
        },
      },
      animation: {
        'float-y': 'float-y 4.5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'msg-in': 'msg-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        typing: 'typing 1.2s ease-in-out infinite',
        'orbit-slow': 'orbit-slow 9s linear infinite',
        shimmer: 'shimmer 4s ease infinite',
        'fade-up': 'fade-up 0.7s ease both',
        'btn-glow': 'btn-glow 2.8s ease-in-out infinite',
        'btn-sheen': 'btn-sheen 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
