import { Module, forwardRef } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelAdapterFactory } from './adapters/channel-adapter.factory';
import { WhatsAppSessionManager } from './whatsapp-session.manager';
import { AuditModule } from '../audit/audit.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [forwardRef(() => AuditModule), ApiKeysModule, BillingModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelAdapterFactory, WhatsAppSessionManager],
  exports: [ChannelsService, ChannelAdapterFactory, WhatsAppSessionManager],
})
export class ChannelsModule {}
