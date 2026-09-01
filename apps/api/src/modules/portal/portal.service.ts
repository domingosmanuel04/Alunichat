import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async createTicketLink(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket não encontrado',
      });
    }
    const token = randomBytes(24).toString('hex');
    await this.redis.set(
      `portal:ticket:${this.hash(token)}`,
      JSON.stringify({ tenantId, ticketId }),
      60 * 60 * 24 * 30,
    );
    return {
      token,
      urlPath: `/portal/${token}`,
      ticketId,
    };
  }

  async getByToken(token: string) {
    const raw = await this.redis.get(`portal:ticket:${this.hash(token)}`);
    if (!raw) {
      throw new NotFoundException({
        code: 'PORTAL_NOT_FOUND',
        message: 'Link inválido ou expirado',
      });
    }
    const parsed = JSON.parse(raw) as { tenantId: string; ticketId: string };
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: parsed.ticketId, tenantId: parsed.tenantId },
      include: {
        contact: { select: { name: true } },
        tenant: { select: { name: true, logoUrl: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'PORTAL_NOT_FOUND',
        message: 'Ticket não encontrado',
      });
    }
    return {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      contactName: ticket.contact?.name || null,
      companyName: ticket.tenant?.name || null,
      companyLogo: ticket.tenant?.logoUrl || null,
    };
  }
}
