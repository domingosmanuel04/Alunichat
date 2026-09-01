'use client';

import { create } from 'zustand';
import { api, type AuthUser } from '@/lib/api';
import { clearAuth, getAccessToken, getTenantSlug, setTenantSlug } from '@/lib/auth';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  hydrated: boolean;
  login: (
    email: string,
    password: string,
    tenantSlug?: string,
    mfaCode?: string,
    captcha?: { captchaToken?: string; captchaAnswer?: string },
  ) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<AuthUser | null>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  hydrated: false,

  async login(email, password, tenantSlug, mfaCode, captcha) {
    set({ loading: true });
    try {
      if (tenantSlug) setTenantSlug(tenantSlug);
      else setTenantSlug(null);
      const result = await api.login({
        email,
        password,
        tenantSlug,
        mfaCode: mfaCode || undefined,
        captchaToken: captcha?.captchaToken,
        captchaAnswer: captcha?.captchaAnswer,
      });
      const user = result.user ?? (await api.me());
      if (user.tenantSlug) setTenantSlug(user.tenantSlug);
      set({ user, loading: false, hydrated: true });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout() {
    clearAuth();
    set({ user: null });
  },

  async fetchMe() {
    if (!getAccessToken()) {
      set({ user: null, hydrated: true });
      return null;
    }
    try {
      const user = await api.me();
      set({ user, hydrated: true });
      return user;
    } catch {
      clearAuth();
      set({ user: null, hydrated: true });
      return null;
    }
  },

  async hydrate() {
    if (get().hydrated) return;
    if (!getAccessToken()) {
      set({ hydrated: true, user: null });
      return;
    }
    // preserve tenant slug if stored
    getTenantSlug();
    await get().fetchMe();
  },
}));
