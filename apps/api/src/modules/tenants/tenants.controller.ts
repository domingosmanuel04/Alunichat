import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import {
  CreateTenantDto,
  SuspendTenantDto,
  UpdateTenantDto,
} from './dto/tenant.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  PlatformOnly,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant settings' })
  getCurrent(@TenantId() tenantId: string) {
    return this.tenants.getCurrent(tenantId);
  }

  @Patch('current')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'Update current tenant settings' })
  updateCurrent(
    @TenantId() tenantId: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.updateCurrent(tenantId, dto, user.sub);
  }

  @Post('current/logo')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'Upload tenant logo image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @TenantId() tenantId: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.uploadLogo(tenantId, file, user.sub);
  }

  @Post('current/referral-code')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'Generate or rotate tenant referral code' })
  generateReferralCode(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.generateReferralCode(tenantId, user.sub);
  }

  @Get('current/business-hours')
  @ApiOperation({ summary: 'Get business hours settings' })
  getBusinessHours(@TenantId() tenantId: string) {
    return this.tenants.getBusinessHours(tenantId);
  }

  @Patch('current/business-hours')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'Update business hours / away message' })
  patchBusinessHours(
    @TenantId() tenantId: string,
    @Body()
    body: {
      timezone?: string;
      days?: { dow: number; start: string; end: string }[];
      awayMessage?: string;
      enabled?: boolean;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.patchBusinessHours(tenantId, body, user.sub);
  }

  @Get('current/whatsapp-templates')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'List WhatsApp message templates' })
  listWhatsAppTemplates(@TenantId() tenantId: string) {
    return this.tenants.listWhatsAppTemplates(tenantId);
  }

  @Post('current/whatsapp-templates')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'Add WhatsApp message template' })
  addWhatsAppTemplate(
    @TenantId() tenantId: string,
    @Body()
    body: { name: string; body: string; category?: string; language?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.addWhatsAppTemplate(tenantId, body, user.sub);
  }

  @Delete('current/whatsapp-templates/:templateId')
  @RequirePermissions('tenant.manage')
  @ApiOperation({ summary: 'Delete WhatsApp message template' })
  removeWhatsAppTemplate(
    @TenantId() tenantId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.removeWhatsAppTemplate(tenantId, templateId, user.sub);
  }

  @Get()
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'List all tenants (platform)' })
  findAll() {
    return this.tenants.findAll();
  }

  @Post()
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'Create tenant (platform)' })
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtPayload) {
    return this.tenants.create(dto, user.sub);
  }

  @Post(':id/suspend')
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'Suspend tenant (platform)' })
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendTenantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenants.suspend(id, dto.reason, user.sub);
  }

  @Post(':id/reactivate')
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  @ApiOperation({ summary: 'Reactivate tenant (platform)' })
  reactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tenants.reactivate(id, user.sub);
  }
}
