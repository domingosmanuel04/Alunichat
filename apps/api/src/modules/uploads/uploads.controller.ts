import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream, existsSync } from 'fs';
import { basename, join } from 'path';
import { Response } from 'express';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import {
  PlatformOnly,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Get('payment-proofs/:filename')
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Download payment proof (tenant or platform)' })
  getPaymentProof(
    @Param('filename') filename: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const safe = basename(filename);
    if (!safe || safe !== filename || safe.includes('..')) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const isPlatform = Boolean(user.platformRole);
    const tenantId = user.tenantId;
    if (
      !isPlatform &&
      tenantId &&
      !(safe.startsWith(`${tenantId}-`) || safe.startsWith(tenantId))
    ) {
      throw new ForbiddenException({
        code: 'PROOF_FORBIDDEN',
        message: 'Comprovativo não pertence a este tenant',
      });
    }

    const fullPath = join(process.cwd(), 'uploads', 'payment-proofs', safe);
    if (!existsSync(fullPath)) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(fullPath));
  }

  @Get('platform/payment-proofs/:filename')
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'Platform download of any payment proof' })
  getPaymentProofPlatform(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const safe = basename(filename);
    if (!safe || safe !== filename || safe.includes('..')) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    const fullPath = join(process.cwd(), 'uploads', 'payment-proofs', safe);
    if (!existsSync(fullPath)) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(fullPath));
  }
}
