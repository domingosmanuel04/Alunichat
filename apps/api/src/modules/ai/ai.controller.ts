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
import { AiService } from './ai.service';
import { AiChatDto, CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai/agents')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get()
  @RequirePermissions('ai.manage')
  findAll(@TenantId() tenantId: string) {
    return this.ai.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions('ai.manage')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ai.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('ai.manage')
  create(@TenantId() tenantId: string, @Body() dto: CreateAiAgentDto) {
    return this.ai.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('ai.manage')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAiAgentDto,
  ) {
    return this.ai.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('ai.manage')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ai.remove(tenantId, id);
  }

  @Post(':id/chat')
  @RequirePermissions('ai.manage')
  @ApiOperation({ summary: 'Chat with AI agent (mock provider)' })
  chat(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AiChatDto,
  ) {
    return this.ai.chat(tenantId, id, dto);
  }
}
