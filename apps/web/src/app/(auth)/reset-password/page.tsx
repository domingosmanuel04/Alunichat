'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

function ResetForm() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Token em falta');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      router.replace('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao redefinir');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised/80 p-8 backdrop-blur-md">
      <h1 className="font-display text-2xl font-semibold text-ink">Nova senha</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Nova senha"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={loading} disabled={!token}>
          Guardar senha
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface bg-hero-glow px-4">
      <div className="absolute left-6 top-6">
        <Link href="/">
          <BrandLogo variant="wordmark" className="h-12 w-auto max-w-[260px]" priority />
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-muted">A carregar…</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
