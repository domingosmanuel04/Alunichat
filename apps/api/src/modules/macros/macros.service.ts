import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMacroDto, UpdateMacroDto } from './dto/macro.dto';

@Injectable()
export class MacrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.macro.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateMacroDto, actorUserId?: string) {
    const macro = await this.prisma.macro.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        actions: dto.actions as object,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'macro.create',
      resource: 'macro',
      resourceId: macro.id,
    });
    return macro;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateMacroDto,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.macro.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'MACRO_NOT_FOUND',
        message: 'Macro não encontrada',
      });
    }
    const macro = await this.prisma.macro.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        actions: dto.actions as object | undefined,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'macro.update',
      resource: 'macro',
      resourceId: id,
    });
    return macro;
  }

  async remove(tenantId: string, id: string, actorUserId?: string) {
    const existing = await this.prisma.macro.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'MACRO_NOT_FOUND',
        message: 'Macro não encontrada',
      });
    }
    await this.prisma.macro.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'macro.delete',
      resource: 'macro',
      resourceId: id,
    });
    return { deleted: true };
  }

  async apply(
    tenantId: string,
    macroId: string,
    conversationId: string,
    actorUserId: string,
  ) {
    const macro = await this.prisma.macro.findFirst({
      where: { id: macroId, tenantId },
    });
    if (!macro) {
      throw new NotFoundException({
        code: 'MACRO_NOT_FOUND',
        message: 'Macro não encontrada',
      });
    }
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversa não encontrada',
      });
    }

    const actions =
      macro.actions && typeof macro.actions === 'object'
        ? (macro.actions as Record<string, unknown>)
        : {};

    const data: Record<string, unknown> = {};
    if (actions.assignToMe === true) {
      data.assigneeId = actorUserId;
      data.status = 'ASSIGNED';
    }
    if (typeof actions.status === 'string') {
      data.status = actions.status;
    }
    if (typeof actions.departmentId === 'string') {
      data.departmentId = actions.departmentId;
    }
    if (typeof actions.tag === 'string' && conversation.contactId) {
      const tagName = actions.tag.trim();
      let tag = await this.prisma.tag.findFirst({
        where: { tenantId, name: tagName },
      });
      if (!tag) {
        tag = await this.prisma.tag.create({
          data: { tenantId, name: tagName, color: '#22c55e' },
        });
      }
      await this.prisma.contactTag.upsert({
        where: {
          contactId_tagId: { contactId: conversation.contactId, tagId: tag.id },
        },
        create: {
          tenantId,
          contactId: conversation.contactId,
          tagId: tag.id,
        },
        update: {},
      }).catch(async () => {
        // ContactTag may use different unique - fallback create ignore
        await this.prisma.contactTag
          .create({
            data: {
              tenantId,
              contactId: conversation.contactId!,
              tagId: tag!.id,
            },
          })
          .catch(() => undefined);
      });
    }

    const updated =
      Object.keys(data).length > 0
        ? await this.prisma.conversation.update({
            where: { id: conversationId },
            data,
          })
        : conversation;

    let replyBody: string | null = null;
    if (typeof actions.reply === 'string' && actions.reply.trim()) {
      replyBody = actions.reply.trim();
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'macro.apply',
      resource: 'conversation',
      resourceId: conversationId,
      after: { macroId, actions },
    });

    return { conversation: updated, replyBody, macro };
  }
}
