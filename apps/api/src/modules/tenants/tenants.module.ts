import { Module, forwardRef } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { BusinessHoursListener } from './business-hours.listener';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';

@Module({
  imports: [
    forwardRef(() => AuditModule),
    forwardRef(() => ChannelsModule),
    RedisModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, BusinessHoursListener],
  exports: [TenantsService],
})
export class TenantsModule {}
