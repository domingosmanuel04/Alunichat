import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEvents } from '../../infrastructure/events/domain-events';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import {
  AssignConversationDto,
  ConversationQueryDto,
  TransferConversationDto,
  UpdateStatusDto,
} from './dto/conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    query: ConversationQueryDto,
    actorUserId?: string,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Record<string, unknown> = {
      tenantId,
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.channelType
        ? { channel: { type: query.channelType } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              {
                lastMessagePreview: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                contact: { name: { contains: query.search, mode: 'insensitive' } },
              },
              {
                messages: {
                  some: {
                    body: { contains: query.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const queue = (query.queue || '').toLowerCase();
    if (query.status) {
      where.status = query.status;
    } else if (queue === 'aguardando' || queue === 'unassigned') {
      where.status = { in: ['OPEN', 'PENDING'] };
      where.assigneeId = null;
    } else if (queue === 'atendendo') {
      where.status = { in: ['OPEN', 'ASSIGNED', 'PENDING'] };
      where.assigneeId = { not: null };
    } else if (queue === 'mine') {
      where.status = { in: ['OPEN', 'ASSIGNED', 'PENDING', 'SNOOZED'] };
      where.assigneeId = actorUserId || query.assigneeId || '__none__';
    } else if (queue === 'open') {
      where.status = { in: ['OPEN', 'PENDING', 'ASSIGNED'] };
    } else if (queue === 'finalizado') {
      where.status = { in: ['CLOSED', 'RESOLVED'] };
    } else if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        include: {
          contact: true,
          channel: {
            select: { id: true, name: true, type: true, provider: true },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async findOne(tenantId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        channel: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: { attachments: true },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    return conversation;
  }

  async assign(
    tenantId: string,
    id: string,
    dto: AssignConversationDto,
    actorUserId?: string,
  ) {
    const existing = await this.findOne(tenantId, id);
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        assigneeId: dto.assigneeId,
        status: 'ASSIGNED',
      },
    });
    this.events.emit(DomainEvents.CONVERSATION_ASSIGNED, {
      tenantId,
      conversationId: id,
      assigneeId: dto.assigneeId,
      previousAssigneeId: existing.assigneeId,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'conversation.assign',
      resource: 'conversation',
      resourceId: id,
      after: { assigneeId: dto.assigneeId },
    });
    return conversation;
  }

  async transfer(
    tenantId: string,
    id: string,
    dto: TransferConversationDto,
    actorUserId?: string,
  ) {
    await this.findOne(tenantId, id);
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        assigneeId: dto.assigneeId,
        teamId: dto.teamId,
        departmentId: dto.departmentId,
        status: dto.assigneeId ? 'ASSIGNED' : 'PENDING',
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'conversation.transfer',
      resource: 'conversation',
      resourceId: id,
      after: dto as object,
    });
    return conversation;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateStatusDto,
    actorUserId?: string,
  ) {
    await this.findOne(tenantId, id);
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: { status: dto.status },
    });
    if (dto.status === 'CLOSED' || dto.status === 'RESOLVED') {
      this.events.emit(DomainEvents.CONVERSATION_CLOSED, {
        tenantId,
        conversationId: id,
        status: dto.status,
      });
      this.events.emit(DomainEvents.WEBHOOK_DISPATCH, {
        tenantId,
        event: 'conversation.closed',
        payload: { conversationId: id, status: dto.status },
      });
    }
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'conversation.status',
      resource: 'conversation',
      resourceId: id,
      after: { status: dto.status },
    });
    return conversation;
  }

  async contactContext(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: {
          include: {
            tags: { include: { tag: true } },
            company: true,
          },
        },
        channel: { select: { id: true, name: true, type: true, status: true } },
        assignee: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    const contactId = conversation.contactId;
    const [deals, tickets, notes, openCount] = await Promise.all([
      this.prisma.deal.findMany({
        where: { tenantId, contactId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: { stage: { select: { name: true } } },
      }),
      this.prisma.ticket.findMany({
        where: { tenantId, contactId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: { tenantId, contactId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          contactId,
          status: { in: ['OPEN', 'PENDING', 'ASSIGNED'] },
        },
      }),
    ]);

    return {
      conversation: {
        id: conversation.id,
        status: conversation.status,
        priority: conversation.priority,
        slaDueAt: conversation.slaDueAt,
        assignee: conversation.assignee,
        department: conversation.department,
        channel: conversation.channel,
      },
      contact: conversation.contact,
      tags: (conversation.contact as { tags?: { tag: { id: string; name: string; color: string } }[] })?.tags?.map(
        (t) => t.tag,
      ) || [],
      deals,
      tickets,
      notes,
      openConversations: openCount,
    };
  }

  async ensureSla(tenantId: string, conversationId: string, minutes = 30) {
    const conversation = await this.findOne(tenantId, conversationId);
    if (conversation.slaDueAt) return conversation;
    const due = new Date(Date.now() + minutes * 60_000);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { slaDueAt: due },
    });
  }

  async setSla(
    tenantId: string,
    conversationId: string,
    slaDueAt: string | null,
  ) {
    await this.findOne(tenantId, conversationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { slaDueAt: slaDueAt ? new Date(slaDueAt) : null },
    });
  }

  async searchMessages(
    tenantId: string,
    q: string,
    page = 1,
    pageSize = 50,
  ) {
    const where = {
      tenantId,
      body: { contains: q, mode: 'insensitive' as const },
    };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: {
              contact: {
                select: { id: true, name: true, phone: true, email: true },
              },
            },
          },
        },
      }),
      this.prisma.message.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async setGroupPermissions(
    tenantId: string,
    id: string,
    dto: { adminsOnlyReply?: boolean },
  ) {
    const conversation = await this.findOne(tenantId, id);
    const metadata =
      conversation.metadata &&
      typeof conversation.metadata === 'object' &&
      !Array.isArray(conversation.metadata)
        ? { ...(conversation.metadata as Record<string, unknown>) }
        : {};
    if (dto.adminsOnlyReply !== undefined) {
      metadata.adminsOnlyReply = dto.adminsOnlyReply;
    }
    return this.prisma.conversation.update({
      where: { id },
      data: { metadata: metadata as object },
    });
  }
}
