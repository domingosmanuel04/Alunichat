'use client';

import { LampLoginV3, type LoginFormValues } from '@/components/lamp-login';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const router = useRouter();
  const [mfaCodeNeeded, setMfaCodeNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaChallenge, setCaptchaChallenge] = useState('');

  const loadCaptcha = useCallback(async () => {
    try {
      const c = await api.getCaptcha();
      setCaptchaToken(c.captchaToken);
      setCaptchaChallenge(c.challenge);
      setShowCaptcha(true);
    } catch {
      setShowCaptcha(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      await login(
        values.email,
        values.password,
        values.tenantSlug || undefined,
        mfaCodeNeeded ? values.mfaCode.trim() || undefined : undefined,
        showCaptcha
          ? { captchaToken, captchaAnswer: values.captchaAnswer.trim() }
          : undefined,
      );
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MFA_REQUIRED') {
        setMfaCodeNeeded(true);
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
    <LampLoginV3
      loading={loading}
      error={error}
      mfaRequired={mfaCodeNeeded}
      showCaptcha={showCaptcha}
      captchaChallenge={captchaChallenge}
      onSubmit={onSubmit}
    />
  );
}
