import type { ApiResponse } from '@alurichat/shared';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  getTenantSlug,
  setTokens,
} from './auth';

const DEFAULT_API_URL = 'http://localhost:4000';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function baseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return raw.replace(/\/$/, '');
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Internal: skip refresh retry to avoid loops */
  _retried?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const url = `${baseUrl()}/api/v1/auth/refresh`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
        const envelope = (await res.json()) as ApiResponse<{
          accessToken?: string;
          refreshToken?: string;
        }>;
        if (!res.ok || !envelope.success || !envelope.data?.accessToken) {
          return false;
        }
        setTokens(
          envelope.data.accessToken,
          envelope.data.refreshToken || refreshToken,
        );
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, headers = {}, _retried } = options;
  const url = new URL(`${baseUrl()}/api/v1${path.startsWith('/') ? path : `/${path}`}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getAccessToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
    const tenant = getTenantSlug();
    if (tenant) reqHeaders['X-Tenant-Slug'] = tenant;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'API indisponível. Verifique se o servidor está a correr (porta 4000).',
      'NETWORK_ERROR',
      0,
    );
  }

  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('Invalid API response', 'INVALID_RESPONSE', res.status);
  }

  if (!res.ok || !envelope.success) {
    if (res.status === 401 && auth && !_retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return request<T>(path, { ...options, _retried: true });
      }
      clearAuth();
    }
    throw new ApiError(
      envelope.error?.message || res.statusText || 'Request failed',
      envelope.error?.code || 'REQUEST_FAILED',
      res.status,
      envelope.error?.details,
    );
  }

  return envelope.data as T;
}

async function requestForm<T>(
  path: string,
  form: FormData,
  options: { method?: string; auth?: boolean; _retried?: boolean } = {},
): Promise<T> {
  const { method = 'POST', auth = true, _retried } = options;
  const url = new URL(`${baseUrl()}/api/v1${path.startsWith('/') ? path : `/${path}`}`);

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (auth) {
    const token = getAccessToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
    const tenant = getTenantSlug();
    if (tenant) reqHeaders['X-Tenant-Slug'] = tenant;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: reqHeaders,
      body: form,
    });
  } catch {
    throw new ApiError(
      'API indisponível. Verifique se o servidor está a correr (porta 4000).',
      'NETWORK_ERROR',
      0,
    );
  }

  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('Invalid API response', 'INVALID_RESPONSE', res.status);
  }

  if (!res.ok || !envelope.success) {
    if (res.status === 401 && auth && !_retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return requestForm<T>(path, form, { ...options, _retried: true });
      }
      clearAuth();
    }
    throw new ApiError(
      envelope.error?.message || res.statusText || 'Request failed',
      envelope.error?.code || 'REQUEST_FAILED',
      res.status,
      envelope.error?.details,
    );
  }

  return envelope.data as T;
}

export type LoginPayload = {
  email: string;
  password: string;
  tenantSlug?: string;
  mfaCode?: string;
  captchaToken?: string;
  captchaAnswer?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
};

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  platformRole?: string | null;
  tenantId?: string | null;
  tenantSlug?: string;
  permissions?: string[];
  workspaceId?: string | null;
  avatarUrl?: string | null;
  membership?: {
    role?: string;
    tenantId?: string;
    tenant?: { id?: string; slug?: string; name?: string };
    [key: string]: unknown;
  } | null;
};

export type DashboardMetrics = {
  greeting?: string;
  insight?: string;
  openConversations?: number;
  pendingConversations?: number;
  newContacts?: number;
  openDeals?: number;
  wonDealsValue?: number;
  wonDeals?: number;
  ticketsOpen?: number;
  messagesToday?: number;
  messagesWeek?: number;
  aiHandledPercent?: number;
  conversations?: { total?: number; open?: number };
  contacts?: number;
  deals?: { open?: number; won?: number };
  leadsByTemperature?: Record<string, number>;
  volumeByChannel?: {
    channelId?: string;
    name?: string;
    phoneNumber?: string | null;
    status?: string;
    messagesWeek?: number;
    conversations?: number;
  }[];
  avgFirstResponseMinutes?: number | null;
  generatedAt?: string;
  [key: string]: unknown;
};

export type Conversation = {
  id: string;
  status?: string;
  priority?: string;
  channelType?: string;
  channel?: { id?: string; name?: string; type?: string; provider?: string };
  subject?: string | null;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  assignedToId?: string | null;
  assigneeId?: string | null;
  departmentId?: string | null;
  contact?: Contact;
  queue?: string | null;
  slaDueAt?: string | null;
  [key: string]: unknown;
};

export type Message = {
  id: string;
  conversationId: string;
  body?: string;
  content?: string;
  direction?: string;
  type?: string;
  status?: string;
  createdAt?: string;
  senderName?: string;
  [key: string]: unknown;
};

export type ConversationDetail = Conversation & {
  messages?: Message[];
};

export type Contact = {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  source?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type Pipeline = {
  id: string;
  name: string;
  stages?: PipelineStage[];
  [key: string]: unknown;
};

export type PipelineStage = {
  id: string;
  name: string;
  order?: number;
  position?: number;
  color?: string;
  [key: string]: unknown;
};

export type Deal = {
  id: string;
  title: string;
  value?: number;
  currency?: string;
  stageId: string;
  pipelineId?: string;
  status?: string;
  contactId?: string | null;
  contact?: Contact;
  [key: string]: unknown;
};

export type Channel = {
  id: string;
  name: string;
  type?: string;
  provider?: string;
  status?: string;
  phoneNumber?: string | null;
  apiKey?: {
    id?: string;
    keyPrefix?: string;
    rawKey?: string;
    authorization?: string;
    warning?: string;
  };
  [key: string]: unknown;
};

export type ScheduledWhatsAppMessage = {
  id: string;
  body: string | null;
  status: string;
  scheduledAt: string;
  to: string | null;
  contactName?: string | null;
  channelId: string | null;
  channelName: string | null;
  conversationId: string;
  failedReason?: string | null;
  sentAt?: string | null;
  createdAt: string;
  messageType?: string;
};

export type QuickReply = {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  category?: string | null;
  [key: string]: unknown;
};

export type WorkflowVersion = {
  id: string;
  version: number;
  definition?: Record<string, unknown> | null;
  publishedAt?: string | null;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown> | null;
  versions?: WorkflowVersion[];
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type AiAgent = {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  model?: string;
  [key: string]: unknown;
};

export type PlatformOverview = {
  tenantsTotal?: number;
  tenantsActive?: number;
  usersTotal?: number;
  messagesToday?: number;
  messagesTotal?: number;
  conversationsTotal?: number;
  revenueMrr?: number;
  tenants?: {
    total?: number;
    active?: number;
    suspended?: number;
    pendingSignups?: number;
    pendingPlanChanges?: number;
  };
  health?: { database?: boolean; redis?: boolean };
  generatedAt?: string;
  [key: string]: unknown;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  plan?: string | { name?: string; tier?: string; [key: string]: unknown };
  createdAt?: string;
  [key: string]: unknown;
};

export type Paginated<T> = T[] | { items: T[]; total?: number; data?: T[] };

function asArray<T>(data: Paginated<T> | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    role: user.role ?? user.membership?.role,
    tenantId: user.tenantId ?? user.membership?.tenantId ?? null,
    tenantSlug: user.tenantSlug ?? user.membership?.tenant?.slug,
  };
}

export const api = {
  async login(payload: LoginPayload) {
    const data = await request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    });
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    if (data.user) {
      data.user = normalizeAuthUser(data.user);
    }
    return data;
  },

  forgotPassword(email: string) {
    return request<{ message?: string; devResetUrl?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  resetPassword(token: string, password: string) {
    return request<{ message?: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
      auth: false,
    });
  },

  registerAccount(form: FormData) {
    return requestForm<{
      message?: string;
      tenantId?: string;
      slug?: string;
      planName?: string;
      status?: string;
    }>('/auth/register', form, { auth: false });
  },

  me() {
    return request<AuthUser>('/auth/me').then(normalizeAuthUser);
  },

  getDashboard() {
    return request<DashboardMetrics>('/analytics/dashboard');
  },

  async listConversations(params?: {
    status?: string;
    queue?: string;
    search?: string;
    channelId?: string;
    channelType?: string;
    assigneeId?: string;
    pageSize?: number;
  }) {
    const data = await request<Paginated<Conversation>>('/conversations', {
      query: { pageSize: 100, ...params },
    });
    return asArray(data);
  },

  getConversation(id: string) {
    return request<ConversationDetail>(`/conversations/${id}`);
  },

  sendMessage(
    conversationId: string,
    body: {
      content: string;
      type?: string;
      scheduledAt?: string;
      isPrivate?: boolean;
    },
  ) {
    return request<Message>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: {
        body: body.content,
        type: body.type ?? 'TEXT',
        scheduledAt: body.scheduledAt,
        isPrivate: body.isPrivate,
      },
    });
  },

  searchMessages(q: string, params?: { page?: number; pageSize?: number }) {
    return request<{
      data?: Message[];
      meta?: { total?: number; page?: number; pageSize?: number };
    }>('/conversations/search/messages', {
      query: { q, page: params?.page ?? 1, pageSize: params?.pageSize ?? 50 },
    });
  },

  conversationSummary(id: string) {
    return request<{
      conversationId?: string;
      summary?: string;
      messageCount?: number;
      provider?: string;
      language?: string;
    }>(`/conversations/${id}/summary`, { method: 'POST', body: {} });
  },

  conversationIntent(id: string) {
    return request<{
      conversationId?: string;
      intent?: string;
      confidence?: number;
      provider?: string;
    }>(`/conversations/${id}/intent`, { method: 'POST', body: {} });
  },

  conversationSuggest(id: string) {
    return request<{
      conversationId?: string;
      suggestion?: string;
      reason?: string;
      intent?: string;
      confidence?: number;
    }>(`/conversations/${id}/suggest`, { method: 'POST', body: {} });
  },

  reactMessage(id: string, emoji: string) {
    return request<Message>(`/conversations/messages/${id}/react`, {
      method: 'POST',
      body: { emoji },
    });
  },

  editMessage(id: string, body: string) {
    return request<Message>(`/conversations/messages/${id}`, {
      method: 'PATCH',
      body: { body },
    });
  },

  setGroupPermissions(
    id: string,
    body: { adminsOnlyReply?: boolean },
  ) {
    return request<Conversation>(`/conversations/${id}/group-permissions`, {
      method: 'PATCH',
      body,
    });
  },

  exportContactLgpd(id: string) {
    return request<Record<string, unknown>>(`/contacts/${id}/export-lgpd`);
  },

  eraseContactLgpd(id: string) {
    return request<Record<string, unknown>>(`/contacts/${id}/erase-lgpd`, {
      method: 'POST',
      body: {},
    });
  },

  optOutContact(id: string, optOut = true) {
    return request<{ contactId?: string; marketingOptOut?: boolean }>(
      `/contacts/${id}/opt-out`,
      { method: 'POST', body: { optOut } },
    );
  },

  launchCampaign(id: string) {
    return request<Record<string, unknown>>(`/campaigns/${id}/launch`, {
      method: 'POST',
      body: {},
    });
  },

  listCatalog() {
    return request<{ items?: Record<string, unknown>[] }>('/catalog');
  },

  saveCatalog(items: Record<string, unknown>[]) {
    return request<{ items?: Record<string, unknown>[] }>('/catalog', {
      method: 'POST',
      body: { items },
    });
  },

  listSavedFilters() {
    return request<{
      items?: { id: string; name: string; query: Record<string, unknown> }[];
    }>('/saved-filters');
  },

  saveFilter(body: {
    id?: string;
    name: string;
    query: Record<string, unknown>;
  }) {
    return request<{
      items?: { id: string; name: string; query: Record<string, unknown> }[];
    }>('/saved-filters', { method: 'POST', body });
  },

  deleteFilter(id: string) {
    return request<{ items?: unknown[] }>(`/saved-filters/${id}`, {
      method: 'DELETE',
    });
  },

  createCheckout(body?: {
    planName?: string;
    provider?: string;
    amount?: number;
  }) {
    return request<{
      sessionId?: string;
      checkoutUrl?: string;
      planName?: string;
      status?: string;
      provider?: string;
      amount?: number;
    }>('/payments/checkout', { method: 'POST', body: body || {} });
  },

  confirmCheckout(sessionId: string) {
    return request<Record<string, unknown>>(
      `/payments/confirm/${sessionId}`,
      { method: 'POST', body: {} },
    );
  },

  getAddons() {
    return request<{
      available?: { key: string; label: string; priceMonthly: number }[];
      active?: string[];
    }>('/addons');
  },

  setAddons(addons: string[]) {
    return request<{
      available?: { key: string; label: string; priceMonthly: number }[];
      active?: string[];
    }>('/addons', { method: 'POST', body: { addons } });
  },

  getWhiteLabel() {
    return request<{
      logoUrl?: string | null;
      primaryColor?: string;
      customDomain?: string | null;
      appName?: string;
      hideAlurichatBranding?: boolean;
    }>('/white-label');
  },

  updateWhiteLabel(body: {
    appName?: string;
    primaryColor?: string;
    customDomain?: string;
    hideAlurichatBranding?: boolean;
    logoUrl?: string;
  }) {
    return request<{
      logoUrl?: string | null;
      primaryColor?: string;
      customDomain?: string | null;
      appName?: string;
      hideAlurichatBranding?: boolean;
    }>('/white-label', { method: 'PATCH', body });
  },

  getTrial() {
    return request<{
      trialEndsAt?: string | null;
      daysLeft?: number | null;
      expired?: boolean;
      softBlocked?: boolean;
      planName?: string;
      status?: string;
    }>('/trial');
  },

  getChangelog() {
    return request<{
      items?: {
        version?: string;
        date?: string;
        title?: string;
        items?: string[];
      }[];
      generatedAt?: string;
    }>('/changelog', { auth: false });
  },

  runQuotaAlerts() {
    return request<Record<string, unknown>>('/platform/quota-alerts/run', {
      method: 'POST',
      body: {},
    });
  },

  updateConversationStatus(conversationId: string, status: string) {
    return request<Conversation>(`/conversations/${conversationId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },

  assignConversation(conversationId: string, assigneeId: string) {
    return request<Conversation>(`/conversations/${conversationId}/assign`, {
      method: 'POST',
      body: { assigneeId },
    });
  },

  async listContacts(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
    source?: string;
  }) {
    const data = await request<Paginated<Contact>>('/contacts', { query: params });
    return asArray(data);
  },

  createContact(body: {
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    tags?: string[];
  }) {
    return request<Contact>('/contacts', { method: 'POST', body });
  },

  updateContact(
    id: string,
    body: { name?: string; email?: string; phone?: string; source?: string },
  ) {
    return request<Contact>(`/contacts/${id}`, { method: 'PATCH', body });
  },

  syncWhatsAppContacts(body?: { channelId?: string }) {
    return request<{
      channels: number;
      scanned: number;
      upserted: number;
      resolvedLids?: number;
      pendingNumbers?: number;
    }>('/contacts/sync/whatsapp', { method: 'POST', body: body || {} });
  },

  async listPipelines() {
    const data = await request<Paginated<Pipeline>>('/crm/pipelines');
    return asArray(data);
  },

  async listDeals(params?: { pipelineId?: string }) {
    const data = await request<Paginated<Deal>>('/crm/deals', { query: params });
    return asArray(data);
  },

  moveDeal(dealId: string, stageId: string) {
    return request<Deal>(`/crm/deals/${dealId}/stage`, {
      method: 'PATCH',
      body: { stageId },
    });
  },

  async listChannels() {
    const data = await request<Paginated<Channel>>('/channels');
    return asArray(data);
  },

  createChannel(body: {
    name: string;
    type: string;
    provider: string;
    phoneNumber?: string;
  }) {
    return request<Channel>('/channels', { method: 'POST', body });
  },

  /** Create a MOCK channel and connect it via the adapter. */
  async connectMockChannel(body?: { name?: string }) {
    const channel = await this.createChannel({
      name: body?.name ?? 'Mock Channel',
      type: 'WHATSAPP',
      provider: 'MOCK',
    });
    return this.connectChannel(channel.id);
  },

  connectChannel(id: string, config?: Record<string, unknown>) {
    return request<Channel>(`/channels/${id}/connect`, {
      method: 'POST',
      body: { config },
    });
  },

  disconnectChannel(id: string) {
    return request<Channel>(`/channels/${id}/disconnect`, {
      method: 'POST',
      body: {},
    });
  },

  getChannelSession(id: string) {
    return request<{
      channelId: string;
      tenantId: string;
      status: string;
      qrCode?: string | null;
      phoneNumber?: string | null;
      error?: string | null;
      updatedAt?: string;
    }>(`/channels/${id}/session`);
  },

  deleteChannel(id: string) {
    return request<{ deleted: boolean }>(`/channels/${id}`, {
      method: 'DELETE',
    });
  },

  getChannel(id: string) {
    return request<Channel>(`/channels/${id}`);
  },

  sendChannelText(id: string, body: { to: string; message: string }) {
    return request<{ externalId: string; status: string; to: string }>(
      `/channels/${id}/messages/text`,
      { method: 'POST', body },
    );
  },

  sendChannelMedia(
    id: string,
    body: {
      to: string;
      url: string;
      caption?: string;
      mediaType?: 'image' | 'audio' | 'document';
      fileName?: string;
    },
  ) {
    return request<{
      externalId: string;
      status: string;
      to: string;
      mediaType: string;
    }>(`/channels/${id}/messages/media`, { method: 'POST', body });
  },

  sendChannelMediaUpload(
    id: string,
    opts: {
      file: Blob;
      fileName?: string;
      to: string;
      mediaType: 'image' | 'audio' | 'document';
      caption?: string;
      ptt?: boolean;
    },
  ) {
    const form = new FormData();
    form.append(
      'file',
      opts.file,
      opts.fileName || (opts.file instanceof File ? opts.file.name : 'upload.bin'),
    );
    form.append('to', opts.to);
    form.append('mediaType', opts.mediaType);
    if (opts.caption) form.append('caption', opts.caption);
    if (opts.fileName) form.append('fileName', opts.fileName);
    if (opts.ptt) form.append('ptt', 'true');
    return requestForm<{
      externalId: string;
      status: string;
      to: string;
      mediaType: string;
    }>(`/channels/${id}/messages/media/upload`, form);
  },

  checkWhatsAppNumber(id: string, number: string) {
    return request<{ number: string; exists: boolean; jid: string | null }>(
      `/channels/${id}/check-number`,
      { method: 'POST', body: { number } },
    );
  },

  syncChannelChats(id: string) {
    return request<{ groups: number; chats: number; total: number }>(
      `/channels/${id}/sync-chats`,
      { method: 'POST', body: {} },
    );
  },

  scheduleWhatsAppMessage(
    channelId: string,
    body: {
      to: string;
      message?: string;
      scheduledAt: string;
      messageType?: 'text' | 'image' | 'audio' | 'document';
      mediaUrl?: string;
      caption?: string;
      fileName?: string;
      ptt?: boolean;
    },
  ) {
    return request<{
      id: string;
      status: string;
      body: string | null;
      scheduledAt: string;
      to: string;
      channelId: string;
      conversationId: string;
      messageType?: string;
      createdAt: string;
      hasMedia?: boolean;
    }>(`/channels/${channelId}/messages/schedule`, { method: 'POST', body });
  },

  scheduleWhatsAppMessageUpload(
    channelId: string,
    opts: {
      file: Blob;
      fileName?: string;
      to: string;
      scheduledAt: string;
      messageType: 'image' | 'audio' | 'document';
      message?: string;
      caption?: string;
      ptt?: boolean;
    },
  ) {
    const form = new FormData();
    form.append(
      'file',
      opts.file,
      opts.fileName || (opts.file instanceof File ? opts.file.name : 'upload.bin'),
    );
    form.append('to', opts.to);
    form.append('scheduledAt', opts.scheduledAt);
    form.append('messageType', opts.messageType);
    if (opts.message) form.append('message', opts.message);
    if (opts.caption) form.append('caption', opts.caption);
    if (opts.fileName) form.append('fileName', opts.fileName);
    if (opts.ptt) form.append('ptt', 'true');
    return requestForm<{
      id: string;
      status: string;
      body: string | null;
      scheduledAt: string;
      to: string;
      channelId: string;
      conversationId: string;
      messageType?: string;
      createdAt: string;
      hasMedia?: boolean;
    }>(`/channels/${channelId}/messages/schedule/upload`, form);
  },

  async listScheduledWhatsAppMessages(params?: {
    channelId?: string;
    status?: string;
  }) {
    const res = await request<{
      data: ScheduledWhatsAppMessage[];
      meta: { total: number };
    }>('/channels/scheduled-messages', { query: params });
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  },

  cancelScheduledWhatsAppMessage(messageId: string) {
    return request<{ id: string; status: string; scheduledAt: string }>(
      `/channels/scheduled-messages/${messageId}`,
      { method: 'DELETE' },
    );
  },

  async listAgents() {
    const data = await request<Paginated<AiAgent>>('/ai/agents');
    return asArray(data);
  },

  platformOverview() {
    return request<PlatformOverview>('/platform/overview');
  },

  async platformTenants() {
    const data = await request<Paginated<Tenant>>('/platform/tenants');
    return asArray(data);
  },

  async platformPendingSignups() {
    const data = await request<Record<string, unknown>[] | Paginated<Record<string, unknown>>>(
      '/platform/signups/pending',
    );
    return asArray(data);
  },

  approveSignup(tenantId: string, password: string) {
    return request<Record<string, unknown>>(`/platform/signups/${tenantId}/approve`, {
      method: 'POST',
      body: { password },
    });
  },

  createPlatformTenant(body: {
    name: string;
    slug: string;
    planName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }) {
    return request<Record<string, unknown>>('/tenants', {
      method: 'POST',
      body,
    });
  },

  rejectSignup(tenantId: string, reason?: string) {
    return request<Record<string, unknown>>(`/platform/signups/${tenantId}/reject`, {
      method: 'POST',
      body: { reason },
    });
  },

  async platformPendingPlanChanges() {
    const data = await request<Record<string, unknown>[] | Paginated<Record<string, unknown>>>(
      '/platform/plan-changes/pending',
    );
    return asArray(data);
  },

  approvePlanChange(tenantId: string) {
    return request<Record<string, unknown>>(`/platform/plan-changes/${tenantId}/approve`, {
      method: 'POST',
      body: {},
    });
  },

  rejectPlanChange(tenantId: string, reason?: string) {
    return request<Record<string, unknown>>(`/platform/plan-changes/${tenantId}/reject`, {
      method: 'POST',
      body: { reason },
    });
  },

  changeTenantPlan(id: string, planName: string) {
    return request<Record<string, unknown>>(`/platform/tenants/${id}/change-plan`, {
      method: 'POST',
      body: { planName },
    });
  },

  suspendTenant(id: string) {
    return request<Record<string, unknown>>(`/platform/tenants/${id}/suspend`, {
      method: 'POST',
      body: {},
    });
  },

  reactivateTenant(id: string) {
    return request<Record<string, unknown>>(`/platform/tenants/${id}/reactivate`, {
      method: 'POST',
      body: {},
    });
  },

  mediaUrl(path?: string | null) {
    if (!path) return '';
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('data:') ||
      path.startsWith('blob:')
    ) {
      return path;
    }
    return `${baseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  },

  /**
   * Open a payment proof via authenticated API (static /uploads/payment-proofs is locked).
   */
  async openPaymentProof(path?: string | null, opts?: { platform?: boolean }) {
    if (!path) return;
    const bare = path.split('?')[0];
    const filename = bare.split('/').pop();
    if (!filename) return;
    const endpoint = opts?.platform
      ? `/uploads/platform/payment-proofs/${encodeURIComponent(filename)}`
      : `/uploads/payment-proofs/${encodeURIComponent(filename)}`;
    const token = getAccessToken();
    const res = await fetch(`${baseUrl()}/api/v1${endpoint}`, {
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(getTenantSlug() ? { 'X-Tenant-Slug': getTenantSlug()! } : {}),
      },
    });
    if (!res.ok) {
      throw new ApiError('Falha ao abrir comprovativo', 'PROOF_DOWNLOAD', res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  async listCompanies() {
    const data = await request<Paginated<Record<string, unknown>>>('/crm/companies');
    return asArray(data);
  },

  async listTasks() {
    const data = await request<Paginated<Record<string, unknown>>>('/tasks');
    return asArray(data);
  },

  async listAppointments() {
    const data = await request<Paginated<Record<string, unknown>>>('/appointments');
    return asArray(data);
  },

  createAppointment(body: {
    title: string;
    startsAt: string;
    endsAt: string;
    contactId?: string;
    serviceName?: string;
    notes?: string;
  }) {
    return request<Record<string, unknown>>('/appointments', { method: 'POST', body });
  },

  confirmAppointment(id: string) {
    return request<Record<string, unknown>>(`/appointments/${id}/confirm`, {
      method: 'POST',
      body: {},
    });
  },

  processAppointmentReminders() {
    return request<Record<string, unknown>>('/appointments/reminders/process', {
      method: 'POST',
      body: {},
    });
  },

  async listCampaigns() {
    const data = await request<Paginated<Record<string, unknown>>>('/campaigns');
    return asArray(data);
  },

  async listAutomations() {
    const data = await request<Paginated<Workflow>>('/workflows');
    return asArray(data);
  },

  getWorkflow(id: string) {
    return request<Workflow>(`/workflows/${id}`);
  },

  createWorkflow(body: {
    name: string;
    triggerType: string;
    description?: string;
    triggerConfig?: Record<string, unknown>;
    definition?: Record<string, unknown>;
  }) {
    return request<Workflow>('/workflows', { method: 'POST', body });
  },

  updateWorkflow(
    id: string,
    body: {
      name?: string;
      description?: string;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      definition?: Record<string, unknown>;
    },
  ) {
    return request<Workflow>(`/workflows/${id}`, { method: 'PATCH', body });
  },

  publishWorkflow(id: string) {
    return request<{ workflow: Workflow }>(`/workflows/${id}/publish`, {
      method: 'POST',
    });
  },

  deleteWorkflow(id: string) {
    return request<{ deleted: boolean }>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  async listQuickReplies() {
    const data = await request<Paginated<QuickReply>>('/quick-replies');
    return asArray(data);
  },

  createQuickReply(body: {
    shortcut: string;
    title: string;
    body: string;
    category?: string;
  }) {
    return request<QuickReply>('/quick-replies', { method: 'POST', body });
  },

  deleteQuickReply(id: string) {
    return request<{ deleted: boolean }>(`/quick-replies/${id}`, { method: 'DELETE' });
  },

  async listKnowledge() {
    const data = await request<Paginated<Record<string, unknown>>>('/knowledge');
    return asArray(data);
  },

  async listTickets() {
    const data = await request<Paginated<Record<string, unknown>>>('/tickets');
    return asArray(data);
  },

  async listIntegrations() {
    const data = await request<Paginated<Record<string, unknown>>>('/webhooks');
    return asArray(data);
  },

  async listWebhooks() {
    const data = await request<Paginated<Record<string, unknown>> | Record<string, unknown>[]>(
      '/webhooks',
    );
    return asArray(data);
  },

  createWebhook(body: {
    url: string;
    secret?: string;
    events: string[];
    active?: boolean;
    headers?: Record<string, string>;
  }) {
    return request<Record<string, unknown>>('/webhooks', { method: 'POST', body });
  },

  updateWebhook(
    id: string,
    body: {
      url?: string;
      secret?: string;
      events?: string[];
      active?: boolean;
      headers?: Record<string, string>;
    },
  ) {
    return request<Record<string, unknown>>(`/webhooks/${id}`, {
      method: 'PATCH',
      body,
    });
  },

  testWebhook(id: string) {
    return request<{ ok: boolean }>(`/webhooks/${id}/test`, { method: 'POST' });
  },

  deleteWebhook(id: string) {
    return request<{ deleted: boolean }>(`/webhooks/${id}`, { method: 'DELETE' });
  },

  async listWebhookDeliveries() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/webhooks/deliveries');
    return asArray(data);
  },

  async listApiKeys() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/api-keys');
    return asArray(data);
  },

  createApiKey(body: { name: string; scopes?: string[] }) {
    return request<{
      id: string;
      name?: string;
      rawKey?: string;
      warning?: string;
      [key: string]: unknown;
    }>('/api-keys', { method: 'POST', body });
  },

  revokeApiKey(id: string) {
    return request<Record<string, unknown>>(`/api-keys/${id}/revoke`, {
      method: 'POST',
    });
  },

  async listTeam() {
    const data = await request<Paginated<Record<string, unknown>>>('/users');
    return asArray(data);
  },

  async listUsers() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/users');
    return asArray(data);
  },

  inviteUser(body: {
    name: string;
    email: string;
    role: string;
    password?: string;
  }) {
    return request<Record<string, unknown>>('/users/invite', {
      method: 'POST',
      body,
    });
  },

  updateUser(
    membershipId: string,
    body: { role?: string; status?: string; permissions?: string[] },
  ) {
    return request<Record<string, unknown>>(`/users/${membershipId}`, {
      method: 'PATCH',
      body,
    });
  },

  removeUser(membershipId: string) {
    return request<{ deleted?: boolean }>(`/users/${membershipId}`, {
      method: 'DELETE',
    });
  },

  getSettings() {
    return request<Record<string, unknown>>('/tenants/current');
  },

  updateSettings(body: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
    settings?: Record<string, unknown>;
  }) {
    return request<Record<string, unknown>>('/tenants/current', {
      method: 'PATCH',
      body,
    });
  },

  uploadTenantLogo(file: File) {
    const form = new FormData();
    form.append('file', file, file.name || 'logo.png');
    return requestForm<Record<string, unknown>>('/tenants/current/logo', form);
  },

  async listBillingPlans() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/billing/plans');
    return asArray(data);
  },

  getBillingSubscription() {
    return request<Record<string, unknown>>('/billing/subscription');
  },

  requestPlanChange(planName: string, file: File) {
    const form = new FormData();
    form.append('planName', planName);
    form.append('paymentProof', file, file.name || 'comprovativo.pdf');
    return requestForm<Record<string, unknown>>('/billing/plan-change', form);
  },

  enableMfa() {
    return request<{
      enabled?: boolean;
      secret?: string;
      message?: string;
      currentCode?: string;
    }>('/auth/mfa/enable', { method: 'POST', body: {} });
  },

  disableMfa() {
    return request<{ enabled?: boolean }>('/auth/mfa/disable', {
      method: 'POST',
      body: {},
    });
  },

  getMfaStatus() {
    return request<{ enabled?: boolean }>('/auth/mfa');
  },

  async listTeams() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/teams');
    return asArray(data);
  },

  createTeam(body: { name: string; description?: string }) {
    return request<Record<string, unknown>>('/teams', { method: 'POST', body });
  },

  deleteTeam(id: string) {
    return request<{ deleted?: boolean }>(`/teams/${id}`, { method: 'DELETE' });
  },

  async listTags() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/tags');
    return asArray(data);
  },

  createTag(body: { name: string; color?: string }) {
    return request<Record<string, unknown>>('/tags', { method: 'POST', body });
  },

  deleteTag(id: string) {
    return request<{ deleted?: boolean }>(`/tags/${id}`, { method: 'DELETE' });
  },

  async listNotifications() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/notifications');
    return asArray(data);
  },

  markNotificationRead(id: string) {
    return request<Record<string, unknown>>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllNotificationsRead() {
    return request<Record<string, unknown>>('/notifications/read-all', {
      method: 'POST',
    });
  },

  async listCrmLeads() {
    const data = await request<Paginated<Record<string, unknown>>>('/crm/leads');
    return asArray(data);
  },

  aiDraft(conversationId: string, body?: { agentId?: string; prompt?: string }) {
    return request<{ draft?: string; agentId?: string; provider?: string }>(
      `/conversations/${conversationId}/ai-draft`,
      { method: 'POST', body: body || {} },
    );
  },

  async listFailedMessages(params?: { page?: number; pageSize?: number }) {
    const data = await request<
      | { data?: Message[]; meta?: unknown }
      | Paginated<Message>
    >('/conversations/messages/failed', { query: params });
    if (data && typeof data === 'object' && Array.isArray((data as { data?: Message[] }).data)) {
      return (data as { data: Message[] }).data;
    }
    return asArray(data as Paginated<Message>);
  },

  retryFailedMessage(id: string) {
    return request<Message>(`/conversations/messages/${id}/retry`, {
      method: 'POST',
      body: {},
    });
  },

  getConversationContext(id: string) {
    return request<{
      conversation?: Record<string, unknown>;
      contact?: Contact;
      tags?: { id?: string; name?: string; color?: string }[];
      deals?: Deal[];
      tickets?: Record<string, unknown>[];
      notes?: Record<string, unknown>[];
      openConversations?: number;
    }>(`/conversations/${id}/context`);
  },

  setConversationSla(
    id: string,
    body: { minutes?: number; slaDueAt?: string | null },
  ) {
    return request<Conversation>(`/conversations/${id}/sla`, {
      method: 'POST',
      body,
    });
  },

  async listMacros() {
    const data = await request<
      Paginated<Record<string, unknown>> | Record<string, unknown>[]
    >('/macros');
    return asArray(data);
  },

  createMacro(body: { name: string; actions: Record<string, unknown> }) {
    return request<Record<string, unknown>>('/macros', { method: 'POST', body });
  },

  applyMacro(macroId: string, conversationId: string) {
    return request<{
      conversation?: Conversation;
      replyBody?: string | null;
      macro?: Record<string, unknown>;
    }>(`/macros/${macroId}/apply/${conversationId}`, {
      method: 'POST',
      body: {},
    });
  },

  getChannelHealth(id: string) {
    return request<{
      status?: string;
      channelId?: string;
      name?: string;
      provider?: string;
      uptimeHints?: {
        connectedAt?: string | null;
        uptimeSeconds?: number | null;
      };
      reconnects?: number;
      updatedAt?: string;
    }>(`/channels/${id}/health`);
  },

  getBusinessHours() {
    return request<{
      timezone?: string;
      days?: { dow: number; start: string; end: string }[];
      awayMessage?: string;
      enabled?: boolean;
    }>('/tenants/current/business-hours');
  },

  updateBusinessHours(body: {
    timezone?: string;
    days?: { dow: number; start: string; end: string }[];
    awayMessage?: string;
    enabled?: boolean;
  }) {
    return request<Record<string, unknown>>('/tenants/current/business-hours', {
      method: 'PATCH',
      body,
    });
  },

  async listWhatsappTemplates() {
    const data = await request<
      | Record<string, unknown>[]
      | Paginated<Record<string, unknown>>
    >('/tenants/current/whatsapp-templates');
    return asArray(data);
  },

  async saveWhatsappTemplates(
    templates:
      | { name: string; body: string; language?: string; category?: string }
      | { name: string; body: string; language?: string; category?: string }[],
  ) {
    const list = Array.isArray(templates) ? templates : [templates];
    const created: Record<string, unknown>[] = [];
    for (const t of list) {
      created.push(
        await request<Record<string, unknown>>('/tenants/current/whatsapp-templates', {
          method: 'POST',
          body: t,
        }),
      );
    }
    return created;
  },

  deleteWhatsappTemplate(templateId: string) {
    return request<{ deleted?: boolean }>(
      `/tenants/current/whatsapp-templates/${templateId}`,
      { method: 'DELETE' },
    );
  },

  generateReferralCode() {
    return request<{ referralCode?: string; tenantId?: string; slug?: string }>(
      '/tenants/current/referral-code',
      { method: 'POST', body: {} },
    );
  },

  async getInvoiceHtml() {
    const data = await request<string | { html?: string; [key: string]: unknown }>(
      '/billing/invoice',
    );
    if (typeof data === 'string') return { html: data };
    return data;
  },

  async listInvoices() {
    const data = await request<
      Record<string, unknown>[] | Paginated<Record<string, unknown>> | { invoices?: Record<string, unknown>[] }
    >('/billing/invoices');
    if (data && typeof data === 'object' && Array.isArray((data as { invoices?: unknown[] }).invoices)) {
      return (data as { invoices: Record<string, unknown>[] }).invoices;
    }
    return asArray(data as Paginated<Record<string, unknown>>);
  },

  getCaptcha() {
    return request<{ captchaToken: string; challenge: string }>('/auth/captcha', {
      auth: false,
    });
  },

  portalGet(token: string) {
    return request<{
      id?: string;
      number?: string | number;
      subject?: string;
      status?: string;
      priority?: string;
      createdAt?: string;
      updatedAt?: string;
      contactName?: string | null;
      companyName?: string | null;
      companyLogo?: string | null;
    }>(`/portal/${token}`, { auth: false });
  },

  createPortalLink(ticketId: string) {
    return request<{ token?: string; urlPath?: string; ticketId?: string }>(
      `/portal/tickets/${ticketId}/link`,
      { method: 'POST', body: {} },
    );
  },

  platformListAlerts() {
    return request<{
      pendingSignups?: unknown[];
      pendingPlanChanges?: unknown[];
      failedWebhooks24h?: number;
      disconnectedChannels?: Record<string, unknown>[];
      nearPlanLimit?: Record<string, unknown>[];
      generatedAt?: string;
    }>('/platform/alerts');
  },

  async platformFeatureFlags() {
    const data = await request<
      Record<string, unknown>[] | Paginated<Record<string, unknown>>
    >('/platform/feature-flags');
    return asArray(data);
  },

  platformUpsertFeatureFlag(body: {
    key: string;
    defaultEnabled?: boolean;
    description?: string;
  }) {
    return request<Record<string, unknown>>('/platform/feature-flags', {
      method: 'POST',
      body,
    });
  },

  platformSetTenantFlag(tenantId: string, key: string, enabled: boolean) {
    return request<Record<string, unknown>>(
      `/platform/tenants/${tenantId}/feature-flags`,
      { method: 'POST', body: { key, enabled } },
    );
  },

  platformImpersonate(tenantId: string) {
    return request<{
      accessToken?: string;
      refreshToken?: string;
      tenant?: { id?: string; slug?: string; name?: string; status?: string };
      impersonating?: boolean;
      message?: string;
      accessHint?: string;
    }>(`/platform/tenants/${tenantId}/impersonate`, {
      method: 'POST',
      body: {},
    });
  },

  platformBackup() {
    return request<Record<string, unknown>>('/platform/backup', {
      method: 'POST',
      body: {},
    });
  },

  platformHealth() {
    return request<Record<string, unknown>>('/platform/health');
  },

  async platformList(path: string) {
    const data = await request<Paginated<Record<string, unknown>>>(path);
    return asArray(data);
  },
};

export { asArray };
