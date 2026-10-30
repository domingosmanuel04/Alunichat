import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  DomainEvents,
  WebhookDispatchEvent,
} from '../../infrastructure/events/domain-events';
import { jsonArrayIncludes } from '../../common/utils/json-array';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(DomainEvents.WEBHOOK_DISPATCH)
  async handleDispatch(event: WebhookDispatchEvent) {
    await this.dispatch(event.tenantId, event.event, event.payload);
  }

  async dispatch(tenantId: string, eventName: string, payload: unknown) {
    const webhooks = (
      await this.prisma.webhook.findMany({
        where: {
          tenantId,
          active: true,
        },
      })
    ).filter(
      (webhook) =>
        jsonArrayIncludes(webhook.events, eventName) ||
        jsonArrayIncludes(webhook.events, '*'),
    );

    for (const webhook of webhooks) {
      await this.deliver(webhook, tenantId, eventName, payload);
    }
  }

  async deliverOne(
    webhook: {
      id: string;
      url: string;
      secret: string;
      headers: unknown;
    },
    tenantId: string,
    eventName: string,
    payload: unknown,
  ) {
    return this.deliver(webhook, tenantId, eventName, payload);
  }

  private async deliver(
    webhook: {
      id: string;
      url: string;
      secret: string;
      headers: unknown;
    },
    tenantId: string,
    eventName: string,
    payload: unknown,
  ) {
    const body = JSON.stringify({
      event: eventName,
      timestamp: new Date().toISOString(),
      data: payload,
    });
    const signature = createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    let status: 'SUCCESS' | 'FAILED' = 'FAILED';
    let responseCode: number | null = null;
    let responseBody: string | null = null;

    const extraHeaders = {
      ...((webhook.headers as Record<string, string>) || {}),
    };
    delete extraHeaders.channelId;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alurichat-Signature': signature,
          'X-Alurichat-Event': eventName,
          ...extraHeaders,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      responseCode = res.status;
      responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? 'SUCCESS' : 'FAILED';
    } catch (err) {
      responseBody = err instanceof Error ? err.message : 'Dispatch failed';
      this.logger.warn(`Webhook ${webhook.id} failed: ${responseBody}`);
    }

    await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        tenantId,
        event: eventName,
        payload: payload as object,
        status,
        attempts: 1,
        responseCode,
        responseBody,
        deliveredAt: status === 'SUCCESS' ? new Date() : null,
      },
    });
  }

  sign(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }
}
