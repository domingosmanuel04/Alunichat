import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      conversationsTotal,
      conversationsOpen,
      messagesToday,
      messagesWeek,
      contactsTotal,
      openDeals,
      leadsByTemperature,
      dealsWon,
      ticketsOpen,
      channels,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { tenantId } }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'PENDING', 'ASSIGNED'] },
        },
      }),
      this.prisma.message.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.message.count({
        where: { tenantId, createdAt: { gte: startOfWeek } },
      }),
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.deal.count({
        where: { tenantId, status: 'OPEN' },
      }),
      this.prisma.contact.groupBy({
        by: ['temperature'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.deal.count({
        where: { tenantId, status: 'WON' },
      }),
      this.prisma.ticket.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'] },
        },
      }),
      this.prisma.channel.findMany({
        where: { tenantId, type: 'WHATSAPP' },
        select: { id: true, name: true, phoneNumber: true, status: true },
      }),
    ]);

    const volumeByChannel = await Promise.all(
      channels.map(async (ch) => {
        const [messages, conversations] = await Promise.all([
          this.prisma.message.count({
            where: {
              tenantId,
              createdAt: { gte: startOfWeek },
              conversation: { channelId: ch.id },
            },
          }),
          this.prisma.conversation.count({
            where: { tenantId, channelId: ch.id },
          }),
        ]);
        return {
          channelId: ch.id,
          name: ch.name,
          phoneNumber: ch.phoneNumber,
          status: ch.status,
          messagesWeek: messages,
          conversations,
        };
      }),
    );

    // Approximate first-response: avg minutes between first inbound and first outbound per recent conversation
    const recent = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startOfWeek },
      },
      select: { id: true },
      take: 80,
      orderBy: { createdAt: 'desc' },
    });

    let avgFirstResponseMinutes: number | null = null;
    if (recent.length > 0) {
      const deltas: number[] = [];
      for (const c of recent) {
        const msgs = await this.prisma.message.findMany({
          where: { conversationId: c.id, tenantId },
          orderBy: { createdAt: 'asc' },
          take: 20,
          select: { direction: true, createdAt: true },
        });
        const firstIn = msgs.find((m) => m.direction === 'INBOUND');
        const firstOut = msgs.find(
          (m) =>
            m.direction === 'OUTBOUND' &&
            firstIn &&
            m.createdAt > firstIn.createdAt,
        );
        if (firstIn && firstOut) {
          deltas.push(
            (firstOut.createdAt.getTime() - firstIn.createdAt.getTime()) /
              60000,
          );
        }
      }
      if (deltas.length > 0) {
        avgFirstResponseMinutes =
          Math.round(
            (deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10,
          ) / 10;
      }
    }

    const temperatureMap = Object.fromEntries(
      leadsByTemperature.map((row) => [row.temperature, row._count._all]),
    );

    return {
      conversations: {
        total: conversationsTotal,
        open: conversationsOpen,
      },
      messagesToday,
      messagesWeek,
      contacts: contactsTotal,
      deals: {
        open: openDeals,
        won: dealsWon,
      },
      leadsByTemperature: {
        COLD: temperatureMap.COLD ?? 0,
        WARM: temperatureMap.WARM ?? 0,
        HOT: temperatureMap.HOT ?? 0,
        VERY_HOT: temperatureMap.VERY_HOT ?? 0,
      },
      ticketsOpen,
      volumeByChannel,
      avgFirstResponseMinutes,
      generatedAt: new Date().toISOString(),
    };
  }
}
