import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/ticket.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequirePermissions('tickets.manage')
  findAll(@TenantId() tenantId: string, @Query() query: TicketQueryDto) {
    return this.tickets.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('tickets.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tickets.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('tickets.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateTicketDto) {
    return this.tickets.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('tickets.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tickets.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tickets.remove(tenantId, id);
  }
}
