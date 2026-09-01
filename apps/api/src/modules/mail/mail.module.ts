import { Module } from '@nestjs/common';
import { QueuesModule } from '../../infrastructure/queues/queues.module';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [QueuesModule],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
