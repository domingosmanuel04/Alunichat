'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaChallenge, setCaptchaChallenge] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const loadCaptcha = useCallback(async () => {
    try {
      const c = await api.getCaptcha();
      setCaptchaToken(c.captchaToken);
      setCaptchaChallenge(c.challenge);
      setCaptchaAnswer('');
      setShowCaptcha(true);
    } catch {
      setShowCaptcha(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(
        email,
        password,
        tenantSlug || undefined,
        mfaRequired ? mfaCode.trim() || undefined : undefined,
        showCaptcha
          ? { captchaToken, captchaAnswer: captchaAnswer.trim() }
          : undefined,
      );
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setError(err.message || 'Introduza o código 2FA');
        return;
      }
      const code = err instanceof ApiError ? err.code : '';
      const msg = err instanceof ApiError ? err.message : 'Falha no login';
      if (
        code === 'CAPTCHA_REQUIRED' ||
        code === 'CAPTCHA_INVALID' ||
        /captcha/i.test(msg)
      ) {
        setShowCaptcha(true);
        await loadCaptcha();
      }
      setError(msg);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface bg-hero-glow px-4">
      <div className="absolute left-6 top-6">
        <Link href="/" className="inline-flex items-center">
          <BrandLogo variant="wordmark" className="h-12 w-auto max-w-[260px]" priority />
        </Link>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised/80 p-8 backdrop-blur-md">
        <h1 className="font-display text-2xl font-semibold text-ink">Entrar</h1>
        <p className="mt-1 text-sm text-ink-muted">Acesse sua operação omnichannel.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Tenant (opcional)"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            placeholder="slug-da-empresa"
          />
          {mfaRequired ? (
            <Input
              label="Código 2FA"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              required
            />
          ) : null}

          {showCaptcha ? (
            <Input
              label={captchaChallenge || 'Captcha'}
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              placeholder="Resposta"
              required
            />
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={loading} size="lg">
            Entrar
          </Button>
        </form>
      <p className="mt-5 text-center text-sm text-ink-muted">
          <Link href="/forgot-password" className="text-brand-light hover:underline">
            Esqueci a senha
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-ink-muted">
          Ainda não tem conta?{' '}
          <Link href="/register" className="text-brand-light hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
