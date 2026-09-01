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
import { MacrosService } from './macros.service';
import { CreateMacroDto, UpdateMacroDto } from './dto/macro.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('macros')
@ApiBearerAuth()
@Controller('macros')
export class MacrosController {
  constructor(private readonly macros: MacrosService) {}

  @Get()
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'List macros' })
  list(@TenantId() tenantId: string) {
    return this.macros.list(tenantId);
  }

  @Post()
  @RequirePermissions('conversation.write')
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateMacroDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.macros.create(tenantId, dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('conversation.write')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMacroDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.macros.update(tenantId, id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('conversation.write')
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.macros.remove(tenantId, id, user.sub);
  }

  @Post(':id/apply/:conversationId')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Apply macro to conversation' })
  apply(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.macros.apply(tenantId, id, conversationId, user.sub);
  }
}
