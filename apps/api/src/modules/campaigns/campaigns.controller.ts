import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermissions('campaign.manage')
  findAll(@TenantId() tenantId: string) {
    return this.campaigns.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions('campaign.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.campaigns.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('campaign.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('campaign.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('campaign.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.campaigns.remove(tenantId, id);
  }

  @Post(':id/launch')
  @RequirePermissions('campaign.manage')
  launch(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.campaigns.launch(tenantId, id);
  }
}
