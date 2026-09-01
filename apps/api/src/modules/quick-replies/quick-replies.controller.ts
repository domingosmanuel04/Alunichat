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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateQuickReplyDto,
  UpdateQuickReplyDto,
} from './dto/quick-reply.dto';
import { QuickRepliesService } from './quick-replies.service';

@ApiTags('quick-replies')
@ApiBearerAuth()
@Controller('quick-replies')
export class QuickRepliesController {
  constructor(private readonly quickReplies: QuickRepliesService) {}

  @Get()
  @RequirePermissions('conversation.read')
  @ApiOperation({ summary: 'List quick replies' })
  findAll(@TenantId() tenantId: string, @Query() query: PaginationDto) {
    return this.quickReplies.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('conversation.read')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.quickReplies.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('conversation.write')
  create(@TenantId() tenantId: string, @Body() dto: CreateQuickReplyDto) {
    return this.quickReplies.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('conversation.write')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuickReplyDto,
  ) {
    return this.quickReplies.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('conversation.write')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.quickReplies.remove(tenantId, id);
  }
}
