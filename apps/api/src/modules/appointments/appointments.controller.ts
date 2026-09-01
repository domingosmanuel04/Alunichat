import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @RequirePermissions('appointments.manage')
  findAll(@TenantId() tenantId: string, @Query() query: AppointmentQueryDto) {
    return this.appointments.findAll(tenantId, query);
  }

  @Post('reminders/process')
  @RequirePermissions('appointments.manage')
  processReminders(@TenantId() tenantId: string) {
    return this.appointments.processReminders(tenantId);
  }

  @Get(':id')
  @RequirePermissions('appointments.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointments.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('appointments.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(tenantId, dto);
  }

  @Post(':id/confirm')
  @RequirePermissions('appointments.manage')
  confirm(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointments.confirm(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('appointments.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('appointments.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointments.remove(tenantId, id);
  }
}
