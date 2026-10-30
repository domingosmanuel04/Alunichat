import { ConfigService } from '@nestjs/config';

const INSECURE_DEFAULTS = new Set([
  'change-me-jwt-secret-min-32-chars-long!!',
  'change-me-jwt-refresh-secret-min-32!!',
  'change-me-32-byte-encryption-key!!',
]);

function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Resolve a secret from env. In production, missing/insecure values abort boot.
 * In development, known insecure defaults are allowed for local DX.
 */
export function requiredSecret(
  config: ConfigService,
  key: string,
  devFallback: string,
  minLength = 32,
): string {
  const raw = (config.get<string>(key) || '').trim();
  const value = raw || (isProduction() ? '' : devFallback);

  if (!value) {
    throw new Error(
      `[config] ${key} is required (set a strong secret, min ${minLength} chars)`,
    );
  }

  if (isProduction() && (INSECURE_DEFAULTS.has(value) || value === devFallback)) {
    throw new Error(
      `[config] ${key} still uses an insecure development default — refuse to start in production`,
    );
  }

  if (isProduction() && value.length < minLength) {
    throw new Error(
      `[config] ${key} must be at least ${minLength} characters in production`,
    );
  }

  return value;
}
