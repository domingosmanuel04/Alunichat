import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import {
  CreateCompanyDto,
  CreateDealDto,
  CreateLeadDto,
  CreatePipelineDto,
  CreateStageDto,
  MoveDealStageDto,
  UpdateDealDto,
} from './dto/crm.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class DealQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pipelineId?: string;
}

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('companies')
  @RequirePermissions('crm.manage')
  listCompanies(@TenantId() tenantId: string) {
    return this.crm.listCompanies(tenantId);
  }

  @Post('companies')
  @RequirePermissions('crm.manage')
  createCompany(@TenantId() tenantId: string, @Body() dto: CreateCompanyDto) {
    return this.crm.createCompany(tenantId, dto);
  }

  @Get('leads')
  @RequirePermissions('crm.manage')
  listLeads(@TenantId() tenantId: string) {
    return this.crm.listLeads(tenantId);
  }

  @Post('leads')
  @RequirePermissions('crm.manage')
  createLead(@TenantId() tenantId: string, @Body() dto: CreateLeadDto) {
    return this.crm.createLead(tenantId, dto);
  }

  @Get('pipelines')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'List pipelines with stages' })
  listPipelines(@TenantId() tenantId: string) {
    return this.crm.listPipelines(tenantId);
  }

  @Post('pipelines')
  @RequirePermissions('crm.manage')
  createPipeline(@TenantId() tenantId: string, @Body() dto: CreatePipelineDto) {
    return this.crm.createPipeline(tenantId, dto);
  }

  @Post('pipelines/:pipelineId/stages')
  @RequirePermissions('crm.manage')
  createStage(
    @TenantId() tenantId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.crm.createStage(tenantId, pipelineId, dto);
  }

  @Get('deals')
  @RequirePermissions('crm.manage')
  listDeals(@TenantId() tenantId: string, @Query() query: DealQueryDto) {
    return this.crm.listDeals(tenantId, query.pipelineId);
  }

  @Get('deals/:id')
  @RequirePermissions('crm.manage')
  getDeal(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.crm.findDeal(tenantId, id);
  }

  @Post('deals')
  @RequirePermissions('crm.manage')
  createDeal(
    @TenantId() tenantId: string,
    @Body() dto: CreateDealDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crm.createDeal(tenantId, dto, user.sub);
  }

  @Patch('deals/:id')
  @RequirePermissions('crm.manage')
  updateDeal(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.crm.updateDeal(tenantId, id, dto);
  }

  @Patch('deals/:id/stage')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Move deal to another stage' })
  moveStage(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: MoveDealStageDto,
  ) {
    return this.crm.moveStage(tenantId, id, dto);
  }

  @Delete('deals/:id')
  @RequirePermissions('crm.manage')
  removeDeal(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.crm.removeDeal(tenantId, id);
  }
}
