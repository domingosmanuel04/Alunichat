import { Module } from '@nestjs/common';
import { FutureController } from './future.controller';
import { FutureService } from './future.service';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Bundle of forward-looking product features shipped as working MVP:
 * changelog, catalog, saved filters, payments stub, addons, white-label,
 * quota alerts, Slack notify, presence helpers, broadcast opt-out helpers.
 */
@Module({
  imports: [MailModule, AuditModule],
  controllers: [FutureController],
  providers: [FutureService],
  exports: [FutureService],
})
export class FutureModule {}
