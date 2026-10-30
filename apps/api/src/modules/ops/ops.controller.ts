import {
  Controller,
  Get,
  Header,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
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
  @ApiOperation({ summary: 'Prometheus metrics (METRICS_TOKEN required in production)' })
  async metrics(@Req() req: Request, @Res() res: Response) {
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const expected = (process.env.METRICS_TOKEN || '').trim();
    if (isProd) {
      if (!expected) {
        throw new UnauthorizedException({
          code: 'METRICS_LOCKED',
          message: 'METRICS_TOKEN must be set in production',
        });
      }
      const auth = req.headers.authorization || '';
      const ok =
        auth === `Bearer ${expected}` ||
        req.headers['x-metrics-token'] === expected;
      if (!ok) {
        throw new UnauthorizedException({
          code: 'METRICS_UNAUTHORIZED',
          message: 'Invalid metrics token',
        });
      }
    } else if (expected) {
      const auth = req.headers.authorization || '';
      const ok =
        auth === `Bearer ${expected}` ||
        req.headers['x-metrics-token'] === expected;
      if (!ok) {
        throw new UnauthorizedException({
          code: 'METRICS_UNAUTHORIZED',
          message: 'Invalid metrics token',
        });
      }
    }
    const body = await this.ops.prometheusMetrics();
    res.type('text/plain').send(body);
  }

  @Post('platform/backup')
  @ApiBearerAuth()
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'Trigger DB backup (mysqldump or JSON fallback)' })
  backup() {
    return this.ops.runBackup();
  }
}
