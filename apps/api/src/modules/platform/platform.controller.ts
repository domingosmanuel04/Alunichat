import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import {
  PlatformOnly,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@RequirePermissions('platform.admin')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview metrics' })
  overview() {
    return this.platform.overview();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'All tenants overview' })
  tenants() {
    return this.platform.listTenants();
  }

  @Get('signups/pending')
  @ApiOperation({ summary: 'Pending signup approvals (payment proofs)' })
  pendingSignups() {
    return this.platform.listPendingSignups();
  }

  @Post('signups/:tenantId/approve')
  @ApiOperation({ summary: 'Approve signup and activate tenant on selected plan' })
  approveSignup(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.approveSignup(tenantId, user.sub);
  }

  @Post('signups/:tenantId/reject')
  @ApiOperation({ summary: 'Reject signup request' })
  rejectSignup(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.rejectSignup(tenantId, user.sub, body?.reason);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Recent platform-wide audit logs' })
  audit() {
    return this.platform.listAudit();
  }

  @Post('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspend tenant' })
  suspendTenant(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.suspendTenant(id, user.sub);
  }

  @Post('tenants/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate tenant' })
  reactivateTenant(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.reactivateTenant(id, user.sub);
  }

  @Post('tenants/:id/change-plan')
  @ApiOperation({ summary: 'Change tenant plan immediately (super admin)' })
  changeTenantPlan(
    @Param('id') id: string,
    @Body() body: { planName: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.changeTenantPlan(id, body.planName, user.sub);
  }

  @Get('plan-changes/pending')
  @ApiOperation({ summary: 'Pending plan change approvals' })
  pendingPlanChanges() {
    return this.platform.listPendingPlanChanges();
  }

  @Post('plan-changes/:tenantId/approve')
  @ApiOperation({ summary: 'Approve plan change request' })
  approvePlanChange(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.approvePlanChange(tenantId, user.sub);
  }

  @Post('plan-changes/:tenantId/reject')
  @ApiOperation({ summary: 'Reject plan change request' })
  rejectPlanChange(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.rejectPlanChange(tenantId, user.sub, body?.reason);
  }

  @Get('health')
  @ApiOperation({ summary: 'Platform health detail' })
  health() {
    return this.platform.health();
  }

  @Get('feature-flags')
  @ApiOperation({ summary: 'List feature flags' })
  listFeatureFlags() {
    return this.platform.listFeatureFlags();
  }

  @Post('feature-flags')
  @ApiOperation({ summary: 'Create or update a feature flag' })
  upsertFeatureFlag(
    @Body() body: { key: string; defaultEnabled?: boolean; description?: string },
  ) {
    return this.platform.upsertFeatureFlag(
      body.key,
      body.defaultEnabled ?? false,
      body.description,
    );
  }

  @Post('tenants/:id/feature-flags')
  @ApiOperation({ summary: 'Set tenant feature flag override' })
  setTenantFeatureFlag(
    @Param('id') id: string,
    @Body() body: { key: string; enabled: boolean },
  ) {
    return this.platform.setTenantFeatureFlag(id, body.key, body.enabled);
  }

  @Post('tenants/:id/impersonate')
  @ApiOperation({
    summary:
      'Impersonate tenant context (audit + slug; SUPER_ADMIN logs in with tenantSlug)',
  })
  impersonate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.platform.impersonate(id, user.sub);
  }

  @Get('alerts')
  @ApiOperation({
    summary:
      'Consolidated alerts: signups, plan changes, webhooks, channels, plan limits',
  })
  listAlerts() {
    return this.platform.listAlerts();
  }
}
