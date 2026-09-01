import { Module, forwardRef } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [forwardRef(() => AuditModule), forwardRef(() => ChannelsModule)],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
