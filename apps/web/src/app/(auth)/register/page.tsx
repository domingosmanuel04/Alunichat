'use client';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

/** Plano implícito no pedido — a UI já não pede escolha. */
const DEFAULT_PLAN_NAME = 'PRO';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaChallenge, setCaptchaChallenge] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  useEffect(() => {
    const ref = search.get('ref') || search.get('referral');
    if (ref) setReferralCode(ref);
  }, [search]);

  useEffect(() => {
    void (async () => {
      try {
        const c = await api.getCaptcha();
        setCaptchaToken(c.captchaToken);
        setCaptchaChallenge(c.challenge);
      } catch {
        setCaptchaToken('');
        setCaptchaChallenge('');
      }
    })();
  }, []);

  function onCompanyChange(value: string) {
    setCompanyName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function validateStep1() {
    if (ownerName.trim().length < 2) return 'Informe o seu nome';
    if (!email.trim()) return 'Informe o e-mail';
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
    if (companyName.trim().length < 2) return 'Informe o nome da empresa';
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
      return 'Slug inválido (use letras minúsculas, números e hífen)';
    }
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validateStep1();
    if (err) {
      setError(err);
      setStep(1);
      return;
    }
    if (!proof) {
      setError('Carregue o comprovativo de pagamento');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('ownerName', ownerName.trim());
      form.append('email', email.trim());
      form.append('password', password);
      form.append('companyName', companyName.trim());
      form.append('slug', slug.trim());
      form.append('planName', DEFAULT_PLAN_NAME);
      if (phone.trim()) form.append('phone', phone.trim());
      if (referralCode.trim()) form.append('referralCode', referralCode.trim());
      if (captchaToken) form.append('captchaToken', captchaToken);
      if (captchaAnswer.trim()) form.append('captchaAnswer', captchaAnswer.trim());
      form.append('paymentProof', proof, proof.name);

      await api.registerAccount(form);
      setDone(true);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : 'Falha ao criar conta');
      try {
        const c = await api.getCaptcha();
        setCaptchaToken(c.captchaToken);
        setCaptchaChallenge(c.challenge);
        setCaptchaAnswer('');
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised/80 p-8 text-center backdrop-blur-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
          Pedido enviado
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Recebemos o seu comprovativo. Assim que o administrador aprovar o
          pagamento, poderá entrar no painel.
        </p>
        <Button className="mt-6 w-full" onClick={() => router.push('/login')}>
          Ir para Entrar
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised/80 p-8 backdrop-blur-md">
      <h1 className="font-display text-2xl font-semibold text-ink">Criar conta</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Preencha os dados e envie o comprovativo de pagamento.
      </p>

      <div className="mt-5 flex items-center gap-2 text-xs">
        {[1, 2].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold',
                step >= n
                  ? 'bg-brand text-white'
                  : 'bg-white/10 text-ink-faint',
              )}
            >
              {n}
            </span>
            <span className={cn('hidden sm:inline', step >= n ? 'text-ink' : 'text-ink-faint')}>
              {n === 1 ? 'Dados' : 'Pagamento'}
            </span>
            {n < 2 ? <span className="h-px flex-1 bg-white/10" /> : null}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {step === 1 ? (
          <>
            <Input
              label="Nome completo"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="O seu nome"
            />
            <Input
              label="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
            <Input
              label="Senha"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <Input
              label="Telefone (opcional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="900000000"
            />
            <Input
              label="Nome da empresa"
              required
              value={companyName}
              onChange={(e) => onCompanyChange(e.target.value)}
              placeholder="Empresa XYZ"
            />
            <Input
              label="Identificador (slug)"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="empresa-xyz"
            />
            <Input
              label="Código de referência (opcional)"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="REF-XXXX"
            />
            {captchaChallenge ? (
              <Input
                label={captchaChallenge}
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="Resposta do captcha"
                required
              />
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-border bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm text-ink">
                <CreditCard className="h-4 w-4 text-brand-light" />
                <strong>Pagamento</strong>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Faça a transferência e envie o comprovativo para ativação da conta.
              </p>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-ink-muted">
                <p className="font-medium text-ink">Dados para transferência</p>
                <p className="mt-1">Titular: Domingos Paulo Manuel</p>
                <p>IBAN: 0040 0000 74402723101 86</p>
                <p>Express: 945 400 126</p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-white/15 p-4">
              <p className="text-sm font-medium text-ink">Comprovativo de pagamento</p>
              <p className="mt-1 text-xs text-ink-muted">
                PNG, JPG, WEBP ou PDF · máx. 5 MB
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="mt-3 block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand/20 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-light"
                onChange={(e) => setProof(e.target.files?.[0] || null)}
              />
              {proof ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                  <Upload className="h-3.5 w-3.5" />
                  {proof.name}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          {step > 1 ? (
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          ) : null}

          {step < 2 ? (
            <Button type="button" className="flex-1" onClick={goNext}>
              Avançar
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" className="flex-1" loading={loading}>
              Enviar pedido
            </Button>
          )}
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Já tem conta?{' '}
        <Link href="/login" className="text-brand-light hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface bg-hero-glow px-4 py-16">
      <div className="absolute left-6 top-6">
        <Link href="/" className="inline-flex items-center">
          <BrandLogo variant="wordmark" className="h-12 w-auto max-w-[260px]" priority />
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised/80 p-8 text-sm text-ink-muted">
            A carregar…
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
