import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvents } from '../../infrastructure/events/domain-events';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { WhatsAppSessionManager } from '../channels/whatsapp-session.manager';
import {
  BusinessHoursSettings,
  TenantsService,
} from './tenants.service';

type MessageReceivedPayload = {
  tenantId: string;
  channelId?: string;
  conversationId: string;
  contactId?: string;
};

@Injectable()
export class BusinessHoursListener {
  private readonly logger = new Logger(BusinessHoursListener.name);

  constructor(
    private readonly tenants: TenantsService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly waSessions: WhatsAppSessionManager,
  ) {}

  @OnEvent(DomainEvents.MESSAGE_RECEIVED)
  async onMessageReceived(event: MessageReceivedPayload) {
    if (!event?.tenantId || !event?.conversationId) return;

    try {
      const hours = await this.tenants.getBusinessHours(event.tenantId);
      if (!hours.enabled) return;
      if (this.isWithinHours(hours)) return;

      const repliedKey = `business-hours:replied:${event.conversationId}`;
      const already = await this.redis.get(repliedKey).catch(() => null);
      if (already) return;

      const conversation = await this.prisma.conversation.findFirst({
        where: { id: event.conversationId, tenantId: event.tenantId },
        include: { contact: true, channel: true },
      });
      if (!conversation?.channel) return;

      const body =
        hours.awayMessage ||
        'Estamos fora do horário de atendimento. Responderemos em breve.';

      let externalId: string | undefined;
      const shouldSendWhatsApp =
        conversation.channel.type === 'WHATSAPP' &&
        (conversation.channel.provider === 'ALURICHAT' ||
          conversation.channel.provider === 'MOCK');

      if (shouldSendWhatsApp) {
        const jid = this.waSessions.resolveContactJid(conversation.contact);
        if (jid) {
          try {
            const result = await this.waSessions.sendText(
              event.tenantId,
              conversation.channelId,
              jid,
              body,
            );
            externalId = result.externalId;
          } catch (err) {
            this.logger.warn(
              `Business hours auto-reply WA failed: ${err instanceof Error ? err.message : err}`,
            );
            return;
          }
        }
      }

      await this.prisma.message.create({
        data: {
          tenantId: event.tenantId,
          conversationId: event.conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          status: 'SENT',
          body,
          isPrivate: false,
          externalId,
          sentAt: new Date(),
          payload: { autoReply: 'business_hours' },
        },
      });

      await this.redis.set(repliedKey, '1', 60 * 60 * 12).catch(() => undefined);
    } catch (err) {
      this.logger.warn(
        `BusinessHoursListener error: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private isWithinHours(hours: BusinessHoursSettings): boolean {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: hours.timezone || 'UTC',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
      const hour = parts.find((p) => p.type === 'hour')?.value || '00';
      const minute = parts.find((p) => p.type === 'minute')?.value || '00';
      const dowMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const dow = dowMap[weekday] ?? now.getDay();
      const current = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

      const day = (hours.days || []).find((d) => Number(d.dow) === dow);
      if (!day) return false;
      return current >= day.start && current <= day.end;
    } catch {
      return true;
    }
  }
}
