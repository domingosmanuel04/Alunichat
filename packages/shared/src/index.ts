/**
 * @alurichat/shared — cross-app types, enums, and permission scopes
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown> & {
    page?: number;
    pageSize?: number;
    total?: number;
    requestId?: string;
  };
}

export const PERMISSION_SCOPES = [
  'conversation.read',
  'conversation.write',
  'conversation.delete',
  'conversation.assign',
  'contact.read',
  'contact.write',
  'crm.manage',
  'campaign.manage',
  'automation.manage',
  'ai.manage',
  'analytics.read',
  'billing.manage',
  'tenant.manage',
  'users.manage',
  'channels.manage',
  'tickets.manage',
  'tasks.manage',
  'appointments.manage',
  'integrations.manage',
  'webhooks.manage',
  'knowledge.manage',
  'audit.read',
  'platform.admin',
] as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const API_KEY_SCOPES = [
  'contacts:read',
  'contacts:write',
  'messages:read',
  'messages:send',
  'crm:read',
  'crm:write',
  'appointments:read',
  'appointments:write',
  'analytics:read',
  'webhooks:manage',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export enum PlanTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
  CHURNED = 'CHURNED',
}

export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_SUPPORT = 'PLATFORM_SUPPORT',
}

export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export enum ChannelType {
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
  MESSENGER = 'MESSENGER',
  WEBCHAT = 'WEBCHAT',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  SMS = 'SMS',
  CUSTOM = 'CUSTOM',
}

export enum ChannelProviderType {
  ALURICHAT = 'ALURICHAT',
  WHATSAPP_CLOUD = 'WHATSAPP_CLOUD',
  EVOLUTION = 'EVOLUTION',
  META_MESSENGER = 'META_MESSENGER',
  META_INSTAGRAM = 'META_INSTAGRAM',
  TELEGRAM_BOT = 'TELEGRAM_BOT',
  SMTP = 'SMTP',
  IMAP = 'IMAP',
  WEBCHAT = 'WEBCHAT',
  MOCK = 'MOCK',
}

export enum ChannelStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  DEGRADED = 'DEGRADED',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  SNOOZED = 'SNOOZED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum ConversationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  INTERNAL = 'INTERNAL',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT',
  STICKER = 'STICKER',
  TEMPLATE = 'TEMPLATE',
  SYSTEM = 'SYSTEM',
  NOTE = 'NOTE',
}

export enum LeadTemperature {
  COLD = 'COLD',
  WARM = 'WARM',
  HOT = 'HOT',
  VERY_HOT = 'VERY_HOT',
}

export enum DealStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  WAITING_INTERNAL = 'WAITING_INTERNAL',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  TESTING = 'TESTING',
  PUBLISHED = 'PUBLISHED',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum Sentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
  URGENT = 'URGENT',
}

export enum AiToolPermissionLevel {
  READ_ONLY = 'READ_ONLY',
  SAFE_WRITE = 'SAFE_WRITE',
  SENSITIVE_WRITE = 'SENSITIVE_WRITE',
  ADMIN = 'ADMIN',
}

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

export const ROLE_PERMISSIONS: Record<TenantRole, PermissionScope[]> = {
  [TenantRole.OWNER]: [...PERMISSION_SCOPES.filter((p) => p !== 'platform.admin')],
  [TenantRole.ADMIN]: [
    'conversation.read',
    'conversation.write',
    'conversation.delete',
    'conversation.assign',
    'contact.read',
    'contact.write',
    'crm.manage',
    'campaign.manage',
    'automation.manage',
    'ai.manage',
    'analytics.read',
    'users.manage',
    'channels.manage',
    'tickets.manage',
    'tasks.manage',
    'appointments.manage',
    'integrations.manage',
    'webhooks.manage',
    'knowledge.manage',
    'audit.read',
  ],
  [TenantRole.SUPERVISOR]: [
    'conversation.read',
    'conversation.write',
    'conversation.assign',
    'contact.read',
    'contact.write',
    'crm.manage',
    'analytics.read',
    'tickets.manage',
    'tasks.manage',
    'appointments.manage',
  ],
  [TenantRole.AGENT]: [
    'conversation.read',
    'conversation.write',
    'contact.read',
    'contact.write',
    'tickets.manage',
    'tasks.manage',
    'appointments.manage',
  ],
  [TenantRole.VIEWER]: [
    'conversation.read',
    'contact.read',
    'analytics.read',
  ],
};

export const PLAN_LIMITS: Record<
  PlanTier,
  {
    users: number;
    agents: number;
    channels: number;
    messagesPerMonth: number;
    contacts: number;
    automations: number;
    aiAgents: number;
    storageMb: number;
    apiRequestsPerDay: number;
    campaigns: number;
    integrations: number;
  }
> = {
  [PlanTier.FREE]: {
    users: 2,
    agents: 1,
    channels: 1,
    messagesPerMonth: 500,
    contacts: 200,
    automations: 2,
    aiAgents: 0,
    storageMb: 100,
    apiRequestsPerDay: 100,
    campaigns: 0,
    integrations: 1,
  },
  [PlanTier.STARTER]: {
    users: 5,
    agents: 3,
    channels: 3,
    messagesPerMonth: 5000,
    contacts: 2000,
    automations: 10,
    aiAgents: 1,
    storageMb: 1024,
    apiRequestsPerDay: 2000,
    campaigns: 3,
    integrations: 5,
  },
  [PlanTier.PRO]: {
    users: 20,
    agents: 15,
    channels: 10,
    messagesPerMonth: 50000,
    contacts: 20000,
    automations: 50,
    aiAgents: 5,
    storageMb: 10240,
    apiRequestsPerDay: 20000,
    campaigns: 20,
    integrations: 20,
  },
  [PlanTier.BUSINESS]: {
    users: 100,
    agents: 80,
    channels: 50,
    messagesPerMonth: 500000,
    contacts: 200000,
    automations: 200,
    aiAgents: 20,
    storageMb: 102400,
    apiRequestsPerDay: 100000,
    campaigns: 100,
    integrations: 50,
  },
  [PlanTier.ENTERPRISE]: {
    users: -1,
    agents: -1,
    channels: -1,
    messagesPerMonth: -1,
    contacts: -1,
    automations: -1,
    aiAgents: -1,
    storageMb: -1,
    apiRequestsPerDay: -1,
    campaigns: -1,
    integrations: -1,
  },
};

export const WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'conversation.created',
  'conversation.closed',
  'contact.created',
  'lead.created',
  'deal.created',
  'deal.stage_changed',
  'appointment.created',
  'appointment.cancelled',
  'ticket.created',
  'ticket.closed',
  'payment.received',
  'workflow.completed',
  'ai.escalated',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
