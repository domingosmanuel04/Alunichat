import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermissions('contact.read')
  findAll(@TenantId() tenantId: string) {
    return this.tags.findAll(tenantId);
  }

  @Post()
  @RequirePermissions('contact.write')
  create(@TenantId() tenantId: string, @Body() dto: CreateTagDto) {
    return this.tags.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('contact.write')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tags.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('contact.write')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tags.remove(tenantId, id);
  }
}
