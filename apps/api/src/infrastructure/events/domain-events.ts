export const DomainEvents = {
  MESSAGE_SENT: 'message.sent',
  MESSAGE_RECEIVED: 'message.received',
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_CLOSED: 'conversation.closed',
  CONTACT_CREATED: 'contact.created',
  DEAL_STAGE_CHANGED: 'deal.stage_changed',
  WEBHOOK_DISPATCH: 'webhook.dispatch',
  AUDIT_LOG: 'audit.log',
  AI_ESCALATED: 'ai.escalated',
} as const;

export type DomainEventName =
  (typeof DomainEvents)[keyof typeof DomainEvents];

export interface MessageSentEvent {
  tenantId: string;
  conversationId: string;
  messageId: string;
  body?: string | null;
}

export interface ConversationAssignedEvent {
  tenantId: string;
  conversationId: string;
  assigneeId: string;
  previousAssigneeId?: string | null;
}

export interface DealStageChangedEvent {
  tenantId: string;
  dealId: string;
  fromStageId: string;
  toStageId: string;
}

export interface WebhookDispatchEvent {
  tenantId: string;
  event: string;
  payload: unknown;
}
