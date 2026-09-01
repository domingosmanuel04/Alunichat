import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @RequirePermissions('webhooks.manage')
  findAll(@TenantId() tenantId: string) {
    return this.webhooks.findAll(tenantId);
  }

  @Get('deliveries')
  @RequirePermissions('webhooks.manage')
  findDeliveries(@TenantId() tenantId: string) {
    return this.webhooks.findDeliveries(tenantId);
  }

  @Post()
  @RequirePermissions('webhooks.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(tenantId, dto);
  }

  @Post('inbox/:id')
  @Public()
  receiveInbox(@Param('id') id: string, @Body() body: unknown) {
    return this.webhooks.receiveInbox(id, body);
  }

  @Post(':id/test')
  @RequirePermissions('webhooks.manage')
  sendTest(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooks.sendTest(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('webhooks.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('webhooks.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.webhooks.remove(tenantId, id);
  }
}
