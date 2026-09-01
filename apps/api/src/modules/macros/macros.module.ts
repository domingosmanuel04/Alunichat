import { Module } from '@nestjs/common';
import { MacrosController } from './macros.controller';
import { MacrosService } from './macros.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MacrosController],
  providers: [MacrosService],
  exports: [MacrosService],
})
export class MacrosModule {}
