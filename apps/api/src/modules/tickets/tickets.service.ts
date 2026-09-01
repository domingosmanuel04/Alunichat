import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: TicketQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { subject: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: { contact: true },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { data: items, meta: paginatedMeta(page, pageSize, total) };
  }

  async findOne(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: { contact: true },
    });
    if (!ticket) {
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found' });
    }
    return ticket;
  }

  async create(tenantId: string, dto: CreateTicketDto) {
    const last = await this.prisma.ticket.findFirst({
      where: { tenantId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;
    return this.prisma.ticket.create({
      data: {
        tenantId,
        number,
        subject: dto.subject,
        description: dto.description,
        status: 'OPEN',
        priority: (dto.priority as 'NORMAL') || 'NORMAL',
        category: dto.category,
        assigneeId: dto.assigneeId,
        teamId: dto.teamId,
        contactId: dto.contactId,
        conversationId: dto.conversationId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTicketDto) {
    await this.findOne(tenantId, id);
    return this.prisma.ticket.update({
      where: { id },
      data: {
        subject: dto.subject,
        description: dto.description,
        status: dto.status,
        priority: dto.priority as never,
        category: dto.category,
        assigneeId: dto.assigneeId,
        teamId: dto.teamId,
        contactId: dto.contactId,
        conversationId: dto.conversationId,
        resolvedAt:
          dto.status === 'RESOLVED' || dto.status === 'CLOSED'
            ? new Date()
            : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.ticket.delete({ where: { id } });
    return { deleted: true };
  }
}
