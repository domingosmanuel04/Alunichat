import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEvents } from '../../infrastructure/events/domain-events';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { SendMessageDto } from './dto/conversation.dto';
import { WhatsAppSessionManager } from '../channels/whatsapp-session.manager';

@Injectable()
export class MessagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagesService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly waSessions: WhatsAppSessionManager,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueScheduled().catch((err) =>
        this.logger.warn(`Scheduled send tick failed: ${err?.message || err}`),
      );
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async list(
    tenantId: string,
    conversationId: string,
    page = 1,
    pageSize = 50,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }

    const where = { tenantId, conversationId };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { attachments: true },
      }),
      this.prisma.message.count({ where }),
    ]);

    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async send(
    tenantId: string,
    conversationId: string,
    dto: SendMessageDto,
    senderUserId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: true,
        channel: true,
      },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }

    const now = new Date();
    const preview = dto.body.slice(0, 200);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isScheduled =
      !dto.isPrivate &&
      scheduledAt &&
      !Number.isNaN(scheduledAt.getTime()) &&
      scheduledAt.getTime() > now.getTime() + 5_000;

    if (isScheduled) {
      const message = await this.prisma.message.create({
        data: {
          tenantId,
          conversationId,
          direction: 'OUTBOUND',
          type: (dto.type as 'TEXT') || 'TEXT',
          status: 'PENDING',
          body: dto.body,
          senderUserId,
          isPrivate: false,
          payload: {
            scheduledAt: scheduledAt!.toISOString(),
            channelId: conversation.channelId,
          },
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          lastMessagePreview: `⏱ ${preview}`,
        },
      });

      return message;
    }

    let externalId: string | undefined;
    const shouldSendWhatsApp =
      !dto.isPrivate &&
      conversation.channel &&
      (conversation.channel.provider === 'ALURICHAT' ||
        conversation.channel.provider === 'MOCK') &&
      conversation.channel.type === 'WHATSAPP';

    if (shouldSendWhatsApp) {
      const jid = this.waSessions.resolveContactJid(conversation.contact);
      if (!jid) {
        throw new BadRequestException({
          code: 'CONTACT_NO_JID',
          message: 'Contato sem número/JID WhatsApp',
        });
      }
      try {
        const result = await this.waSessions.sendText(
          tenantId,
          conversation.channelId,
          jid,
          dto.body,
        );
        externalId = result.externalId;
      } catch (err) {
        const failed = await this.prisma.message.create({
          data: {
            tenantId,
            conversationId,
            direction: 'OUTBOUND',
            type: (dto.type as 'TEXT') || 'TEXT',
            status: 'FAILED',
            body: dto.body,
            senderUserId,
            isPrivate: false,
            failedReason:
              err instanceof Error ? err.message : 'Falha ao enviar no WhatsApp',
            payload: { channelId: conversation.channelId },
          },
        });
        throw new BadRequestException({
          code: 'WHATSAPP_SEND_FAILED',
          message:
            err instanceof Error ? err.message : 'Falha ao enviar no WhatsApp',
          details: { messageId: failed.id },
        });
      }
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          tenantId,
          conversationId,
          direction: dto.isPrivate ? 'INTERNAL' : 'OUTBOUND',
          type: (dto.type as 'TEXT') || 'TEXT',
          status: 'SENT',
          body: dto.body,
          senderUserId,
          isPrivate: dto.isPrivate ?? false,
          externalId,
          sentAt: now,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          lastMessagePreview: preview,
          unreadCount: 0,
          status:
            conversation.status === 'CLOSED' || conversation.status === 'RESOLVED'
              ? 'OPEN'
              : conversation.status === 'PENDING'
                ? 'ASSIGNED'
                : conversation.status,
          assigneeId: conversation.assigneeId || senderUserId,
        },
      }),
    ]);

    this.events.emit(DomainEvents.MESSAGE_SENT, {
      tenantId,
      conversationId,
      messageId: message.id,
      body: message.body,
    });

    this.events.emit(DomainEvents.WEBHOOK_DISPATCH, {
      tenantId,
      event: 'message.sent',
      payload: {
        conversationId,
        messageId: message.id,
        body: message.body,
      },
    });

    if (message.isPrivate || message.direction === 'INTERNAL') {
      await this.notifyMentions(tenantId, message.id, conversationId, dto.body, senderUserId);
    }

    return message;
  }

  private async notifyMentions(
    tenantId: string,
    messageId: string,
    conversationId: string,
    body: string,
    senderUserId: string,
  ) {
    const tokens = Array.from(
      new Set(
        (body.match(/@([^\s@]+(?:@[^\s@]+\.[^\s@]+)?|[^\s@]+)/g) || []).map((t) =>
          t.slice(1).trim(),
        ),
      ),
    ).filter(Boolean);
    if (!tokens.length) return;

    const memberships = await this.prisma.membership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    const matched = memberships.filter((m) => {
      if (m.userId === senderUserId) return false;
      const email = (m.user.email || '').toLowerCase();
      const name = (m.user.name || '').toLowerCase();
      return tokens.some((t) => {
        const needle = t.toLowerCase();
        return (
          email === needle ||
          email.startsWith(needle) ||
          name === needle ||
          name.includes(needle) ||
          (name && name.split(/\s+/).some((part) => part === needle))
        );
      });
    });

    for (const m of matched) {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId: m.userId,
          type: 'mention',
          title: 'Menção numa nota interna',
          body: body.slice(0, 200),
          data: {
            conversationId,
            messageId,
            mentionedBy: senderUserId,
          },
          channel: 'IN_APP',
        },
      });
    }
  }

  async react(
    tenantId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
    });
    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });
    }

    const payload =
      message.payload &&
      typeof message.payload === 'object' &&
      !Array.isArray(message.payload)
        ? { ...(message.payload as Record<string, unknown>) }
        : {};

    const reactions = Array.isArray(payload.reactions)
      ? ([...payload.reactions] as { userId: string; emoji: string; at: string }[])
      : [];

    const existingIdx = reactions.findIndex(
      (r) => r.userId === userId && r.emoji === emoji,
    );
    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1);
    } else {
      reactions.push({
        userId,
        emoji,
        at: new Date().toISOString(),
      });
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { payload: { ...payload, reactions } },
    });
  }

  async editMessage(
    tenantId: string,
    messageId: string,
    userId: string,
    body: string,
  ) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
    });
    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });
    }
    if (message.senderUserId && message.senderUserId !== userId) {
      throw new BadRequestException({
        code: 'NOT_MESSAGE_AUTHOR',
        message: 'Só o autor pode editar a mensagem',
      });
    }

    const payload =
      message.payload &&
      typeof message.payload === 'object' &&
      !Array.isArray(message.payload)
        ? { ...(message.payload as Record<string, unknown>) }
        : {};

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        body,
        payload: {
          ...payload,
          editedAt: new Date().toISOString(),
          editedBy: userId,
        },
      },
    });
  }

  private async processDueScheduled() {
    const now = new Date();
    const pending = await this.prisma.message.findMany({
      where: {
        direction: 'OUTBOUND',
        status: 'PENDING',
        isPrivate: false,
      },
      take: 25,
      orderBy: { createdAt: 'asc' },
      include: {
        conversation: {
          include: { contact: true, channel: true },
        },
      },
    });

    for (const msg of pending) {
      const payload = (msg.payload || {}) as Record<string, unknown>;
      const scheduledRaw = payload.scheduledAt;
      if (typeof scheduledRaw !== 'string') continue;
      const when = new Date(scheduledRaw);
      if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime()) continue;

      const conversation = msg.conversation;
      if (!conversation?.channel || !conversation.contact) continue;

      try {
        const jid = this.waSessions.resolveContactJid(conversation.contact);
        if (!jid) throw new Error('Sem JID');

        const kind =
          typeof payload.messageType === 'string'
            ? payload.messageType
            : 'text';
        let externalId: string | undefined;

        if (kind === 'text' || !kind) {
          const result = await this.waSessions.sendText(
            msg.tenantId,
            conversation.channelId,
            jid,
            msg.body || '',
          );
          externalId = result.externalId;
        } else {
          const mediaType =
            kind === 'audio' || kind === 'document' || kind === 'image'
              ? kind
              : 'image';
          const mediaPath =
            typeof payload.mediaPath === 'string' ? payload.mediaPath : null;
          const mediaUrl =
            typeof payload.mediaUrl === 'string' ? payload.mediaUrl : null;
          const buffer =
            mediaPath && fs.existsSync(mediaPath)
              ? fs.readFileSync(mediaPath)
              : undefined;
          if (!buffer && !mediaUrl) {
            throw new Error('Mídia do agendamento não encontrada');
          }
          const result = await this.waSessions.sendMedia(
            msg.tenantId,
            conversation.channelId,
            jid,
            {
              buffer,
              url: mediaUrl || undefined,
              mediaType,
              caption: msg.body || undefined,
              fileName:
                typeof payload.fileName === 'string'
                  ? payload.fileName
                  : undefined,
              mimetype:
                typeof payload.mimetype === 'string'
                  ? payload.mimetype
                  : undefined,
              ptt: Boolean(payload.ptt),
            },
          );
          externalId = result.externalId;
          if (mediaPath) {
            try {
              fs.unlinkSync(mediaPath);
            } catch {
              // ignore
            }
          }
        }

        await this.prisma.message.update({
          where: { id: msg.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            externalId,
            payload: { ...payload, sentScheduled: true, mediaPath: null },
          },
        });
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: (msg.body || '').slice(0, 200),
          },
        });
        this.logger.log(`Scheduled message ${msg.id} sent (${kind})`);
      } catch (err) {
        await this.prisma.message.update({
          where: { id: msg.id },
          data: {
            status: 'FAILED',
            failedReason:
              err instanceof Error ? err.message : 'Falha no envio agendado',
          },
        });
        this.logger.warn(
          `Scheduled message ${msg.id} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  async listFailed(tenantId: string, page = 1, pageSize = 50) {
    const where = { tenantId, status: 'FAILED' as const };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          conversation: {
            select: {
              id: true,
              subject: true,
              contact: { select: { id: true, name: true, phone: true } },
              channel: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.message.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async retry(tenantId: string, messageId: string, senderUserId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId, status: 'FAILED' },
    });
    if (!message || !message.body) {
      throw new NotFoundException({
        code: 'FAILED_MESSAGE_NOT_FOUND',
        message: 'Mensagem falhada não encontrada',
      });
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'PENDING', failedReason: null },
    });
    try {
      const sent = await this.send(
        tenantId,
        message.conversationId,
        { body: message.body, type: message.type || 'TEXT' },
        senderUserId,
      );
      // Keep history: mark old as superseded
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          failedReason: 'Retentado — ver mensagem nova',
          payload: {
            ...((message.payload as object) || {}),
            retriedAs: sent.id,
          },
        },
      });
      return sent;
    } catch (err) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          failedReason:
            err instanceof Error ? err.message : 'Retry falhou',
        },
      });
      throw err;
    }
  }
}
