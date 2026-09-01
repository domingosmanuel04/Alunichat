import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import {
  CreateDocumentDto,
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from './dto/knowledge.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @RequirePermissions('knowledge.manage')
  findAll(@TenantId() tenantId: string) {
    return this.knowledge.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions('knowledge.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.knowledge.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('knowledge.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateKnowledgeBaseDto) {
    return this.knowledge.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('knowledge.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledge.update(tenantId, id, dto);
  }

  @Post(':id/documents')
  @RequirePermissions('knowledge.manage')
  addDocument(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.knowledge.addDocument(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('knowledge.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.knowledge.remove(tenantId, id);
  }
}
