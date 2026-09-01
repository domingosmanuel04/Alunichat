import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { Public } from '../../common/decorators/public.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Public ticket status by portal token' })
  getByToken(@Param('token') token: string) {
    return this.portal.getByToken(token);
  }

  @Post('tickets/:ticketId/link')
  @ApiBearerAuth()
  @RequirePermissions('tickets.manage')
  @ApiOperation({ summary: 'Create public portal link for a ticket' })
  createLink(
    @TenantId() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.portal.createTicketLink(tenantId, ticketId);
  }
}
