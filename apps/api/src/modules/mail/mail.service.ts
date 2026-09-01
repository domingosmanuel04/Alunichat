import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAIL_QUEUE } from '../../infrastructure/queues/queues.module';
import { RedisService } from '../../infrastructure/redis/redis.service';

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  readonly outbox: OutboundMail[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @Optional()
    @InjectQueue(MAIL_QUEUE)
    private readonly mailQueue?: Queue,
  ) {}

  /**
   * Enqueue via Bull when available; otherwise send immediately.
   * When MAIL_SMTP_URL is set, also push to Redis list `mail:queue`.
   */
  async send(mail: OutboundMail) {
    this.remember(mail);

    if (this.mailQueue) {
      try {
        await this.mailQueue.add('send', mail, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
        });
        this.logger.log(`[mail] queued job to=${mail.to} subject=${mail.subject}`);
        return { queued: true, provider: 'bull' as const };
      } catch (err) {
        this.logger.warn(
          `Bull enqueue failed, sending direct: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return this.sendDirect(mail);
  }

  /** Deliver immediately (console stub and/or SMTP via nodemailer). */
  async sendDirect(mail: OutboundMail) {
    this.remember(mail);

    const from = this.config.get<string>('MAIL_FROM', 'noreply@alurichat.local');
    const smtpUrl = this.config.get<string>('MAIL_SMTP_URL');

    this.logger.log(`[mail] from=${from} to=${mail.to} subject=${mail.subject}`);
    this.logger.debug(mail.text);

    if (smtpUrl) {
      try {
        await this.redis.getClient().lpush(
          'mail:queue',
          JSON.stringify({ ...mail, from, queuedAt: new Date().toISOString() }),
        );
        this.logger.log('[mail] queued for SMTP (redis mail:queue)');
      } catch (err) {
        this.logger.warn(
          `Redis mail:queue push failed: ${err instanceof Error ? err.message : err}`,
        );
      }

      try {
        // Optional runtime dependency — documented; install with: pnpm add nodemailer
        const nodemailer = await import('nodemailer');
        const transport = nodemailer.createTransport(smtpUrl);
        await transport.sendMail({
          from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html || undefined,
        });
        this.logger.log(`[mail] SMTP delivered to=${mail.to}`);
        return { queued: false, provider: 'smtp' as const };
      } catch (err) {
        this.logger.warn(
          `SMTP send failed (console stub kept): ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { queued: true, provider: 'console' as const };
  }

  private remember(mail: OutboundMail) {
    this.outbox.push({ ...mail, text: mail.text.slice(0, 2000) });
    if (this.outbox.length > 100) this.outbox.shift();
  }
}
