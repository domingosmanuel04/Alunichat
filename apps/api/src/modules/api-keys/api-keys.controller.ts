import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @RequirePermissions('integrations.manage')
  findAll(@TenantId() tenantId: string) {
    return this.apiKeys.findAll(tenantId);
  }

  @Post()
  @RequirePermissions('integrations.manage')
  @ApiOperation({ summary: 'Create API key (raw key returned once)' })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeys.create(tenantId, dto, user.sub);
  }

  @Post(':id/revoke')
  @RequirePermissions('integrations.manage')
  revoke(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeys.revoke(tenantId, id, user.sub);
  }
}
