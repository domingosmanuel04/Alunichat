'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Building2, KeyRound, Lock, Mail, ShieldQuestion } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthInput } from './AuthInput';

export type LoginFormValues = {
  email: string;
  password: string;
  tenantSlug: string;
  mfaCode: string;
  captchaAnswer: string;
};

type LoginFormProps = {
  loading?: boolean;
  error?: string | null;
  mfaRequired?: boolean;
  showCaptcha?: boolean;
  captchaChallenge?: string;
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
};

export function LoginForm({
  loading = false,
  error,
  mfaRequired = false,
  showCaptcha = false,
  captchaChallenge,
  onSubmit,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      email,
      password,
      tenantSlug,
      mfaCode,
      captchaAnswer,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header className="space-y-3">
        <Link href="/" className="inline-flex items-center" aria-label="ALURICHAT">
          <BrandLogo variant="wordmark" className="h-10 w-auto max-w-[220px]" priority />
        </Link>
        <h1 className="font-lamp-display text-[2.15rem] font-medium leading-tight tracking-[-0.02em] text-white sm:text-[2.4rem]">
          Bem-vindo de volta.
        </h1>
        <p className="font-lamp-display text-lg italic text-white/45">Puxe uma cadeira.</p>
      </header>

      <div className="space-y-4">
        <AuthInput
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail size={18} strokeWidth={1.75} />}
          required
        />
        <AuthInput
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={18} strokeWidth={1.75} />}
          required
        />
        <AuthInput
          label="Tenant (opcional)"
          name="tenant"
          autoComplete="organization"
          placeholder="slug-da-empresa"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          icon={<Building2 size={18} strokeWidth={1.75} />}
        />
        {mfaRequired ? (
          <AuthInput
            label="Código 2FA"
            name="mfa"
            autoComplete="one-time-code"
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            icon={<KeyRound size={18} strokeWidth={1.75} />}
            required
          />
        ) : null}
        {showCaptcha ? (
          <AuthInput
            label={captchaChallenge || 'Captcha'}
            name="captcha"
            placeholder="Resposta"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            icon={<ShieldQuestion size={18} strokeWidth={1.75} />}
            required
          />
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-white/45 transition-colors duration-300 hover:text-brand-cyan"
        >
          Esqueci a senha
        </Link>
      </div>

      <motion.button
        type="submit"
        disabled={loading}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        className="group relative w-full overflow-hidden rounded-xl bg-brand-gradient px-5 py-3.5 text-[15px] font-semibold text-white shadow-glow animate-btn-glow transition-[filter] duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:animate-none"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-btn-sheen"
        />
        <span className="relative">{loading ? 'A entrar…' : 'Entrar'}</span>
      </motion.button>

      <p className="text-center text-sm text-white/40">
        Ainda não tem conta?{' '}
        <Link
          href="/register"
          className="font-medium text-white/80 transition-colors duration-300 hover:text-brand-cyan"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
