import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { AiService } from '../ai/ai.service';
import {
  AssignConversationDto,
  ConversationQueryDto,
  SendMessageDto,
  TransferConversationDto,
  UpdateStatusDto,
} from './dto/conversation.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ConversationStatus } from '@alurichat/shared';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
    private readonly ai: AiService,
  ) {}

  @Get()
  @RequirePermissions('conversation.read')
  findAll(
    @TenantId() tenantId: string,
    @Query() query: ConversationQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversations.findAll(tenantId, query, user.sub);
  }

  @Get('search/messages')
  @RequirePermissions('conversation.read')
  @ApiOperation({ summary: 'Search messages by body across conversations' })
  searchMessages(
    @TenantId() tenantId: string,
    @Query('q') q: string,
    @Query() query: PaginationDto,
  ) {
    return this.conversations.searchMessages(
      tenantId,
      q || '',
      query.page ?? 1,
      query.pageSize ?? 50,
    );
  }

  @Get('messages/failed')
  @RequirePermissions('conversation.read')
  @ApiOperation({ summary: 'List failed outbound messages' })
  listFailed(@TenantId() tenantId: string, @Query() query: PaginationDto) {
    return this.messages.listFailed(
      tenantId,
      query.page ?? 1,
      query.pageSize ?? 50,
    );
  }

  @Post('messages/:messageId/retry')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Retry a failed message' })
  retryMessage(
    @TenantId() tenantId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messages.retry(tenantId, messageId, user.sub);
  }

  @Post('messages/:messageId/react')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Add or toggle a reaction on a message' })
  reactMessage(
    @TenantId() tenantId: string,
    @Param('messageId') messageId: string,
    @Body() body: { emoji: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messages.react(tenantId, messageId, user.sub, body.emoji);
  }

  @Patch('messages/:messageId')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Edit a message body' })
  editMessage(
    @TenantId() tenantId: string,
    @Param('messageId') messageId: string,
    @Body() body: { body: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messages.editMessage(tenantId, messageId, user.sub, body.body);
  }

  @Get(':id')
  @RequirePermissions('conversation.read')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.conversations.findOne(tenantId, id);
  }

  @Get(':id/context')
  @RequirePermissions('conversation.read')
  contactContext(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.conversations.contactContext(tenantId, id);
  }

  @Post(':id/ai-draft')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Generate AI draft reply (uses RAG when knowledge exists)' })
  async aiDraft(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { agentId?: string; prompt?: string },
  ) {
    await this.conversations.findOne(tenantId, id);

    if (await this.ai.hasKnowledgeDocuments(tenantId)) {
      const rag = await this.ai.ragDraft(tenantId, id, body.prompt);
      return {
        draft: rag.draft,
        provider: rag.provider,
        usedRag: true,
        knowledgeDocs: rag.knowledgeDocs,
      };
    }

    const agents = await this.ai.findAll(tenantId);
    const agent =
      (body.agentId && agents.find((a) => a.id === body.agentId)) ||
      agents.find((a) => a.active) ||
      agents[0];
    if (!agent) {
      return {
        draft:
          body.prompt ||
          'Olá! Obrigado pelo contacto. Em que posso ajudar?',
        provider: 'fallback',
      };
    }
    const result = await this.ai.chat(tenantId, agent.id, {
      message:
        body.prompt ||
        'Escreve um rascunho curto e profissional em português para responder ao cliente com base no histórico.',
      conversationId: id,
    });
    const draft =
      (result as { reply?: string }).reply ||
      (result as { content?: string }).content ||
      (result as { message?: string }).message ||
      (typeof result === 'string' ? result : JSON.stringify(result));
    return { draft, agentId: agent.id, provider: 'ai', usedRag: false };
  }

  @Post(':id/summary')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'AI summarize conversation' })
  summarize(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ai.summarizeConversation(tenantId, id);
  }

  @Post(':id/intent')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Classify conversation intent' })
  intent(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ai.classifyIntent(tenantId, id);
  }

  @Post(':id/suggest')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Suggest next step for conversation' })
  suggest(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ai.suggestNextStep(tenantId, id);
  }

  @Patch(':id/group-permissions')
  @RequirePermissions('conversation.write')
  @ApiOperation({ summary: 'Set group conversation permissions' })
  setGroupPermissions(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { adminsOnlyReply?: boolean },
  ) {
    return this.conversations.setGroupPermissions(tenantId, id, body);
  }

  @Post(':id/sla')
  @RequirePermissions('conversation.write')
  setSla(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { minutes?: number; slaDueAt?: string | null },
  ) {
    if (body.slaDueAt !== undefined) {
      return this.conversations.setSla(tenantId, id, body.slaDueAt);
    }
    return this.conversations.ensureSla(tenantId, id, body.minutes ?? 30);
  }

  @Post(':id/assign')
  @RequirePermissions('conversation.assign')
  assign(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversations.assign(tenantId, id, dto, user.sub);
  }

  @Post(':id/transfer')
  @RequirePermissions('conversation.assign')
  transfer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: TransferConversationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversations.transfer(tenantId, id, dto, user.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('conversation.write')
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversations.updateStatus(tenantId, id, dto, user.sub);
  }

  @Post(':id/close')
  @RequirePermissions('conversation.write')
  close(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversations.updateStatus(
      tenantId,
      id,
      { status: ConversationStatus.CLOSED },
      user.sub,
    );
  }

  @Get(':id/messages')
  @RequirePermissions('conversation.read')
  listMessages(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query() query: PaginationDto,
  ) {
    return this.messages.list(
      tenantId,
      id,
      query.page ?? 1,
      query.pageSize ?? 50,
    );
  }

  @Post(':id/messages')
  @RequirePermissions('conversation.write')
  sendMessage(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messages.send(tenantId, id, dto, user.sub);
  }
}
