import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FutureService } from './future.service';
import { Public } from '../../common/decorators/public.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import {
  PlatformOnly,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';

@ApiTags('future')
@Controller()
export class FutureController {
  constructor(private readonly future: FutureService) {}

  @Public()
  @Get('changelog')
  @ApiOperation({ summary: 'Product changelog' })
  changelog() {
    return this.future.changelog();
  }

  @Public()
  @Get('regions')
  regions() {
    return this.future.regions();
  }

  @Get('catalog')
  @ApiBearerAuth()
  @RequirePermissions('conversation.read')
  listCatalog(@TenantId() tenantId: string) {
    return this.future.listCatalog(tenantId);
  }

  @Post('catalog')
  @ApiBearerAuth()
  @RequirePermissions('settings.manage')
  saveCatalog(@TenantId() tenantId: string, @Body() body: { items: unknown[] }) {
    return this.future.saveCatalog(tenantId, body.items || []);
  }

  @Get('saved-filters')
  @ApiBearerAuth()
  listFilters(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.future.listSavedFilters(tenantId, user.sub);
  }

  @Post('saved-filters')
  @ApiBearerAuth()
  saveFilter(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { id?: string; name: string; query: Record<string, unknown> },
  ) {
    return this.future.saveFilter(tenantId, user.sub, body);
  }

  @Delete('saved-filters/:id')
  @ApiBearerAuth()
  deleteFilter(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.future.deleteFilter(tenantId, user.sub, id);
  }

  @Post('payments/checkout')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  checkout(
    @TenantId() tenantId: string,
    @Body() body: { planName?: string; provider?: string; amount?: number },
  ) {
    return this.future.createCheckout(tenantId, body);
  }

  @Post('payments/confirm/:sessionId')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  confirm(@Param('sessionId') sessionId: string) {
    return this.future.confirmCheckout(sessionId);
  }

  @Get('addons')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  addons(@TenantId() tenantId: string) {
    return this.future.getAddons(tenantId);
  }

  @Post('addons')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  setAddons(@TenantId() tenantId: string, @Body() body: { addons: string[] }) {
    return this.future.setAddons(tenantId, body.addons || []);
  }

  @Get('white-label')
  @ApiBearerAuth()
  @RequirePermissions('settings.manage')
  whiteLabel(@TenantId() tenantId: string) {
    return this.future.getWhiteLabel(tenantId);
  }

  @Patch('white-label')
  @ApiBearerAuth()
  @RequirePermissions('settings.manage')
  updateWhiteLabel(
    @TenantId() tenantId: string,
    @Body()
    body: {
      appName?: string;
      primaryColor?: string;
      customDomain?: string;
      hideAlurichatBranding?: boolean;
      logoUrl?: string;
    },
  ) {
    return this.future.updateWhiteLabel(tenantId, body);
  }

  @Get('trial')
  @ApiBearerAuth()
  trial(@TenantId() tenantId: string) {
    return this.future.trialStatus(tenantId);
  }

  @Post('contacts/:id/opt-out')
  @ApiBearerAuth()
  @RequirePermissions('contact.write')
  optOut(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { optOut?: boolean },
  ) {
    return this.future.setMarketingOptOut(tenantId, id, body.optOut !== false);
  }

  @Post('platform/quota-alerts/run')
  @ApiBearerAuth()
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  runQuotaAlerts() {
    return this.future.runQuotaAlerts();
  }

  @Post('platform/slack-test')
  @ApiBearerAuth()
  @PlatformOnly()
  @RequirePermissions('platform.admin')
  slackTest(@Body() body: { text?: string }) {
    return this.future.notifySlack(body.text || 'ALURICHAT Slack test');
  }
}
