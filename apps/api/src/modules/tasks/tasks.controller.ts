import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermissions('tasks.manage')
  findAll(@TenantId() tenantId: string, @Query() query: TaskQueryDto) {
    return this.tasks.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('tasks.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tasks.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('tasks.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('tasks.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tasks.remove(tenantId, id);
  }
}
