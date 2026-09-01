import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MAIL_QUEUE } from '../../infrastructure/queues/queues.module';
import { MailService, OutboundMail } from './mail.service';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<OutboundMail>): Promise<void> {
    this.logger.debug(`Processing mail job ${job.id} to=${job.data?.to}`);
    await this.mail.sendDirect(job.data);
  }
}
