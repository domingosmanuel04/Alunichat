import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { DomainEvents } from '../../infrastructure/events/domain-events';
import { AuditService } from '../audit/audit.service';
import { WhatsAppSessionManager } from '../channels/whatsapp-session.manager';
import {
  ContactQueryDto,
  CreateContactDto,
  UpdateContactDto,
} from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
    private readonly waSessions: WhatsAppSessionManager,
  ) {}

  async findAll(tenantId: string, query: ContactQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 2000);
    const where: Record<string, unknown> = {
      tenantId,
      ...(query.temperature ? { temperature: query.temperature } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      // Contatos: todos os 1:1 (inclui LID pendente). Exclui só grupos / broadcast.
      AND: [
        { NOT: { phone: { contains: '@g.us' } } },
        { NOT: { phone: { contains: '@broadcast' } } },
        { NOT: { phone: { equals: '0@s.whatsapp.net' } } },
        { NOT: { phone: { equals: '0' } } },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }],
        include: { company: true },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async syncFromWhatsApp(tenantId: string, channelId?: string, actorUserId?: string) {
    const result = await this.waSessions.syncContacts(tenantId, channelId);
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'contact.sync_whatsapp',
      resource: 'contact',
      after: result as object,
    });
    return result;
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: { company: true, tags: { include: { tag: true } } },
    });
    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Contact not found',
      });
    }
    return contact;
  }

  async create(tenantId: string, dto: CreateContactDto, actorUserId?: string) {
    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        name: dto.name,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        companyId: dto.companyId,
        jobTitle: dto.jobTitle,
        source: dto.source,
        temperature: dto.temperature ?? 'COLD',
        score: dto.score ?? 0,
        customFields: (dto.customFields as object) ?? {},
        metadata: (dto.metadata as object) ?? {},
        ownerId: actorUserId,
      },
    });
    this.events.emit(DomainEvents.CONTACT_CREATED, {
      tenantId,
      contactId: contact.id,
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'contact.create',
      resource: 'contact',
      resourceId: contact.id,
      after: { name: contact.name },
    });
    return contact;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateContactDto,
    actorUserId?: string,
  ) {
    await this.findOne(tenantId, id);
    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        name: dto.name,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        companyId: dto.companyId,
        jobTitle: dto.jobTitle,
        source: dto.source,
        temperature: dto.temperature,
        score: dto.score,
        customFields: dto.customFields as object | undefined,
        metadata: dto.metadata as object | undefined,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'contact.update',
      resource: 'contact',
      resourceId: id,
      after: dto as object,
    });
    return contact;
  }

  async remove(tenantId: string, id: string, actorUserId?: string) {
    await this.findOne(tenantId, id);
    await this.prisma.contact.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'contact.delete',
      resource: 'contact',
      resourceId: id,
    });
    return { deleted: true };
  }

  async exportLgpd(tenantId: string, id: string) {
    const contact = await this.findOne(tenantId, id);
    const [conversations, messages, deals, tickets] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { tenantId, contactId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.findMany({
        where: {
          tenantId,
          conversation: { contactId: id },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.deal.findMany({
        where: { tenantId, contactId: id },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.ticket.findMany({
        where: { tenantId, contactId: id },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      contact,
      conversations,
      messages,
      deals,
      tickets,
    };
  }

  async eraseLgpd(tenantId: string, id: string, actorUserId?: string) {
    await this.findOne(tenantId, id);

    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, contactId: id },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    await this.prisma.$transaction(async (tx) => {
      if (conversationIds.length) {
        await tx.message.updateMany({
          where: { tenantId, conversationId: { in: conversationIds } },
          data: { body: null, payload: {} },
        });
      }

      await tx.contact.update({
        where: { id },
        data: {
          name: 'Anonimizado',
          firstName: null,
          lastName: null,
          phone: null,
          email: null,
          jobTitle: null,
          customFields: {},
          metadata: {
            lgpdErasedAt: new Date().toISOString(),
            lgpdErasedBy: actorUserId || null,
          },
        },
      });
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'contact.lgpd_erase',
      resource: 'contact',
      resourceId: id,
      after: { anonymized: true },
    });

    return { erased: true, contactId: id };
  }
}
