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
import { ContactsService } from './contacts.service';
import {
  ContactQueryDto,
  CreateContactDto,
  UpdateContactDto,
} from './dto/contact.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions('contact.read')
  @ApiOperation({ summary: 'List contacts' })
  findAll(@TenantId() tenantId: string, @Query() query: ContactQueryDto) {
    return this.contacts.findAll(tenantId, query);
  }

  @Post('sync/whatsapp')
  @RequirePermissions('contact.write')
  @ApiOperation({ summary: 'Sync contacts from connected WhatsApp instances' })
  syncWhatsApp(
    @TenantId() tenantId: string,
    @Body() body: { channelId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contacts.syncFromWhatsApp(
      tenantId,
      body?.channelId,
      user.sub,
    );
  }

  @Get(':id')
  @RequirePermissions('contact.read')
  @ApiOperation({ summary: 'Get contact' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.contacts.findOne(tenantId, id);
  }

  @Get(':id/export-lgpd')
  @RequirePermissions('contact.read')
  @ApiOperation({ summary: 'Export contact data (LGPD portability)' })
  exportLgpd(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.contacts.exportLgpd(tenantId, id);
  }

  @Post(':id/erase-lgpd')
  @RequirePermissions('contact.write')
  @ApiOperation({ summary: 'Anonymize contact (LGPD erasure)' })
  eraseLgpd(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contacts.eraseLgpd(tenantId, id, user.sub);
  }

  @Post()
  @RequirePermissions('contact.write')
  @ApiOperation({ summary: 'Create contact' })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contacts.create(tenantId, dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('contact.write')
  @ApiOperation({ summary: 'Update contact' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contacts.update(tenantId, id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('contact.write')
  @ApiOperation({ summary: 'Soft-delete contact' })
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contacts.remove(tenantId, id, user.sub);
  }
}
