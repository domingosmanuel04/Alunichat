'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevUrl(null);
    try {
      const res = await api.forgotPassword(email.trim());
      setMessage(res.message || 'Verifique o seu e-mail.');
      if (res.devResetUrl) setDevUrl(String(res.devResetUrl));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao pedir redefinição');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface bg-hero-glow px-4">
      <div className="absolute left-6 top-6">
        <Link href="/">
          <BrandLogo variant="wordmark" className="h-12 w-auto max-w-[260px]" priority />
        </Link>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised/80 p-8 backdrop-blur-md">
        <h1 className="font-display text-2xl font-semibold text-ink">Recuperar senha</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enviamos um link para redefinir a senha (em desenvolvimento o link aparece abaixo).
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </p>
          ) : null}
          {devUrl ? (
            <a href={devUrl} className="block break-all text-xs text-brand-light underline">
              {devUrl}
            </a>
          ) : null}
          <Button type="submit" className="w-full" loading={loading}>
            Enviar link
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-muted">
          <Link href="/login" className="text-brand-light hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}
