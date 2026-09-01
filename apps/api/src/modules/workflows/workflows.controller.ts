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
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @RequirePermissions('automation.manage')
  findAll(@TenantId() tenantId: string) {
    return this.workflows.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions('automation.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.workflows.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('automation.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('automation.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflows.update(tenantId, id, dto);
  }

  @Post(':id/publish')
  @RequirePermissions('automation.manage')
  @ApiOperation({ summary: 'Publish workflow (DRAFT → PUBLISHED + version)' })
  publish(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.workflows.publish(tenantId, id);
  }

  @Delete(':id')
  @RequirePermissions('automation.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.workflows.remove(tenantId, id);
  }
}
