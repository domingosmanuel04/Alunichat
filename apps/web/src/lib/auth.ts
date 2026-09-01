const ACCESS_TOKEN_KEY = 'alurichat_access_token';
const REFRESH_TOKEN_KEY = 'alurichat_refresh_token';
const TENANT_SLUG_KEY = 'alurichat_tenant_slug';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getTenantSlug(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TENANT_SLUG_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function setTenantSlug(slug: string | null) {
  if (!canUseStorage()) return;
  if (slug) localStorage.setItem(TENANT_SLUG_KEY, slug);
  else localStorage.removeItem(TENANT_SLUG_KEY);
}

export function clearAuth() {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TENANT_SLUG_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
