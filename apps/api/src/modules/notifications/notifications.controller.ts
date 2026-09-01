import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.findAll(tenantId, user.sub, query);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateNotificationDto) {
    return this.notifications.create(tenantId, dto);
  }

  @Patch(':id/read')
  markRead(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notifications.markRead(tenantId, id, user.sub);
  }

  @Post('read-all')
  markAllRead(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(tenantId, user.sub);
  }
}
