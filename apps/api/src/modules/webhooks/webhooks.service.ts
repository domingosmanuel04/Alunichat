import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        headers: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findDeliveries(tenantId: string, take = 100) {
    return this.prisma.webhookDelivery.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 500),
      include: {
        webhook: { select: { id: true, url: true, headers: true } },
      },
    });
  }

  async create(tenantId: string, dto: CreateWebhookDto) {
    const secret = dto.secret?.trim() || randomBytes(24).toString('hex');
    return this.prisma.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        secret,
        events: dto.events,
        active: dto.active ?? true,
        headers: (dto.headers as object) ?? {},
      },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        headers: true,
        createdAt: true,
      },
    });
  }

  async sendTest(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });
    if (!webhook) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    }
    await this.dispatcher.deliverOne(webhook, tenantId, 'webhook.test', {
      message: 'Teste de webhook Alurichat',
      webhookId: webhook.id,
      channelId:
        (webhook.headers as Record<string, string> | null)?.channelId ?? null,
    });
    return { ok: true };
  }

  async receiveInbox(id: string, body: unknown) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id },
    });
    if (!webhook) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    }
    await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        event: 'inbox',
        payload: (body as object) ?? {},
        status: 'SUCCESS',
        attempts: 1,
        responseCode: 200,
        responseBody: 'ok',
        deliveredAt: new Date(),
      },
    });
    return { ok: true, event: 'inbox' };
  }

  async update(tenantId: string, id: string, dto: UpdateWebhookDto) {
    const existing = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    }
    return this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        active: dto.active,
        headers: dto.headers as object | undefined,
      },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        headers: true,
        updatedAt: true,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    }
    await this.prisma.webhook.delete({ where: { id } });
    return { deleted: true };
  }
}
