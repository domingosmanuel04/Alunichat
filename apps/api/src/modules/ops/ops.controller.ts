import { Controller, Get, Header, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { OpsService } from './ops.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  PlatformOnly,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';

@ApiTags('ops')
@Controller()
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Prometheus metrics' })
  async metrics(@Res() res: Response) {
    const body = await this.ops.prometheusMetrics();
    res.type('text/plain').send(body);
  }

  @Post('platform/backup')
  @ApiBearerAuth()
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'Trigger DB backup (pg_dump or JSON fallback)' })
  backup() {
    return this.ops.runBackup();
  }
}
