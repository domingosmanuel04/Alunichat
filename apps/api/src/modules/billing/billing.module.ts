import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanLimitsService } from './plan-limits.service';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AuditModule, MailModule],
  controllers: [BillingController],
  providers: [BillingService, PlanLimitsService],
  exports: [BillingService, PlanLimitsService],
})
export class BillingModule {}
